---
title: 'Syscalls Demystified: Understanding the Assembly-Level Mechanics'
date: 2024-09-17 14:50:52
tags:
- assembly
- C
- gcc
- libc
- perf
- syscall
- process
- linker
- kernel
categories:
- Operating System Construction 
---
## Preface
As we saw recently when trying to create the shortest C program. The biggest cost in this program was glibc and its overhead for running the program. How does it look in the case of asm? Today we will see.

I know how scary assembly is if you've only heard about it. But it's not as scary as they say. I'll present everything in a very simple way so that everyone can understand what's going on and who responsible for what.

## What is a syscall?
To fully understand what is happening, first I will tell you what is syscall.
By default, programs run in user mode, which is a restricted execution environment where the program cannot directly access hardware resources. In user mode, a program does not have direct access I/O operations, network access, managing system processes or system files. To interact with it, programs need to communicate with the kernel via kernel mode. 

### Syscall mechanism
A system call (syscall) is the mechanism by which a program running in user mode requests services from the kernel. e.g. *write()* used in *prinf()* to access stdout or *exit()* to exit the process. More details and determining the moment at which we switch between modes will be discussed later in this article.

I will use *sys_write* and *write()* to differentiate between the real syscall and the glibc function call.
## Writing a program without glibc
I think now is a good moment to reveal that we can compile a C file without glibc which can be done with flag ```-nostdlib``` the fact is, that this program will not be similar to C.
### The smallest C program without glibc
```c
void _start() {
    __asm__ volatile (
        "mov $60, %rax\n"  
        "mov $0, %rdi\n"  
        "syscall"
    );
}
```
### Performance of the program
This is the performance result of the above code::
```java
0.06   msec task-clock:u            #    0.284 CPUs utilized
1      page-faults:u                #    16.743 K/sec
1119   cycles:u                     #    0.018 GHz
5      stalled-cycles-frontend:u    #    0.45% frontend cycles idle
0      stalled-cycles-backend:u     
6      instructions:u               #    0.01  insn per cycle
```
As we can see the result is much better than the last C static linked program, that's because we don't need glibc anymore. 
## Assembly Explanation
Now time for some assembly, which will explain to us what happened above:
```json
section .text
    global _start // Inform the linker where is program start

_start:           // Program start
    mov rax, 60   // syscall number for exit (60)
    mov rdi, 0    // set exit code 0 (rdi = 0)
    syscall       // invoke the system call with syscall number -
                  // stored in rax and exit code in rdi
```
This is <span class="reveal-text" before="x86-64" after="64 bit"></span> architecture, this is important because code and syscall codes on <span class="reveal-text" before="x86" after="32 bit"></span> are different :D
<details>
  <summary><span style="color:rgb(0, 152, 241)">How it would look on x86</span></summary>
```json
section .text
    global _start // Infrom the linker where is program start

_start:            
    mov rax, 1   
    mov rdi, 0    
    int 0x80       
```
By calling *int 0x80* you invoke interrupt and go to x80 address in interrupt handler table
the 0x80 == 128 is special interrupt programmed only for program system calls
</details>
<br>
<details>
  <summary><span style="color:rgb(0, 152, 241)">How this code became executable</span></summary>
Unless like in C's gcc going through pre-processing, compiling, assembling and linking.
Assembly doesn't need to be pre-processed or compiled. On linux you can use <span class="reveal-text" before="NASM" after="Netwide Assembler"></span> or <span class="reveal-text" before="AS" after="GNU Assembler"></span> as a assembling tool.
I used:
``` 
nasm -f elf64 -o exit.o exit.asm 
``` 
where elf64 is format of object file it could be win32
The next step is linking 
```
ld exit.o -o exit
``` 
which is resolving symbols relocating adresses from relative to absolute and making final excutable format, sets up the entry point, the sections (text, data, etc.), and the memory layout necessary for the operating system to run the program.
</details>

## Invoking syscalls and register usage
The syscall instruction invokes the syscall with the code contained in the rax register. Then, depending on the code, arguments are required, which are successively passed in rdi, rsi, rdx, r10, r8, r9, this is the convention adopted.
### List of syscalls
[Here](https://x64.syscall.sh/) you can find a list of all syscalls on x86-64 to see what they look like.
### Performance metrics of the smallest assembly program in terms of instructions:
```java
0.10   msec task-clock:u            #    0.257 CPUs utilized
1      page-faults:u                #    9.980 K/sec
1289   cycles:u                     #    0.013 GHz
5      stalled-cycles-frontend:u    #    0.39% frontend cycles idle
0      stalled-cycles-backend:u
4      instructions:u               #    0.00  insn per cycle
```
## Where is the actual entry point to the program?
In UNIX-like systems, programs start execution from the *_start* function. Not the *main()* function, as we are accustomed to in C. The *main()* function is essentially a wrapper, like many other components in C. Somewhere within *_start*, the *__libc_start_main* function is invoked, followed by a call to main. Here’s a simplified visualization of this process:
```json
_start:
    // rdi already contains argc (passed by kernel)
    // rsi already contains argv (passed by kernel)
    // stack already aligned somewhere

    // Call main handler
    call __libc_start_main

    // Exit
    mov rdi, rax  // Use main's return value as exit status
    mov rax, 60   // syscall number for exit
    syscall
```
If you’re wondering how the return value ends up in the rax register, it’s due to the [System V ABI calling convention](https://wiki.osdev.org/System_V_ABI). This convention dictates how functions pass arguments and return values between each other and the operating system.

## Do All Programs Need an Exit?
What happens if there is no exit system call? Without an explicit exit, the instruction pointer would jump to the next address, fetch the next memory block, and attempt to decode and execute it. This would likely result in a segmentation fault, as the memory would not contain valid executable instructions.

You might wonder why in C you can write `int main(){}` without explicitly returning a value or even use `void main(){}` (which is still accepted for backward compatibility). Surprisingly, the program will compile and execute correctly.

If you don't provide a return value, glibc implicitly exits with a 0 code. This behavior is evident when using *void main()*. We see an exit call is present:
![exit call in callee list](main_no_return.png)

### ret or sys_exit
The _start function is the entry point, at least for statically linked programs, for dynamically linked programs (if the dynamic loader performs C/C++/Objective-C startup initialization by including the entry point from crt1.o) it could be the dynamic linker itself. But what is always the same is the Initial Process Stack.
![initial process stack](init_process_stack.png)
Ret moves the instruction pointer to a return address on the stack, which doesn't exist here, so calling ret from _start surely will cause a segfault. ret can be called from main (because a new stack frame was created by calling this function) sys_exit or exit() can also be called, which will prevent us from returning to _start.

## glibc's Role
Saying that three lines of assembly eliminate redundancy in glibc misses the broader context. Glibc acts as an intermediary, making system calls like *sys_write* easier to use by providing wrappers like direct *write()* or indirect *printf()*. It handles details like register saving/restoring. While direct assembly skips everything, glibc flushing stdout, thread management, and other necessary actions before the final program exit make it much more than just "redundant code." Skipping these operations could lead to undefined behavior or even program crashes.

For example, after calling *write()*, the program needs to continue executing correctly, so it's essential to restore the registers to avoid overwriting critical data. This isn't necessary for *sys_exit* because it clobbers some of the registers and changes context anyway, it's crucial for other syscalls where the program continues running.

There is  also syscall(), a small library function that invokes the system call whose assembly language interface has the specified number with the specified arguments.  Employing syscall() is useful, for example, when invoking a system call that has no wrapper function in the C library. It provides saving, restoring registers and returning an error, which is always a better solution than a syscall in direct Assembly.

### Glibc, glibc, libc is there sth other?
[Musl](https://musl.libc.org/) is a smaller alternative to glibc (7x smaller), and it's more common to see inline assembly syscalls used there. However, glibc’s complexity supports more features and safer execution. Hope I'll write something more about it someday.

## Vicious circle
What's funny is that glibc itself is not able to call any syscall using C because it doesn't have direct access to registers. For that, you need an assembler, which will probably be somewhere in the depths of glibc. Calling syscall in assembly causes an interrupt; the system goes into kernel mode and uses IDT to determine how to process a specific interrupt; finally, the interrupt goes to entry_64.S, which will pass control to the appropriate handler written in C via syscall_table, where there is usually something like:
```c
asmlinkage long sys_read(unsigned int fd, char __user *buf, size_t count);
asmlinkage long sys_write(unsigned int fd, const char __user *buf, size_t count);
```
Then the appropriate function, e.g. sys_write, can be used. As you can see, it goes full circle C->assembly->C where the return of syscall code will look similarly to the sysret called in assembly.

## Is it worth it?
Today, going down to assembly is rarely justified when embedded devices have developed so much, where memory is no longer so limited, and clock speeds have increased so much that time is also no longer an issue. However, it is always worth being aware of how it works "under the hood".

## What next?
The next article will mainly cover the size of the executable itself, the construction of the elf64 file, how the system reads and executes it, and probably how to construct it by yourself.

I really appreciate any feedback, so if you have any comments or suggestions, feel free to leave a comment below ⬇️.