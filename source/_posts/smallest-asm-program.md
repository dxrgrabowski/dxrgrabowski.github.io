---
title: smallest-asm-program
date: 2024-09-17 14:50:52
tags:
---
## Preface
As we saw recently when trying to create the shortest C program. The biggest cost in this program was glibc and its standard procedures for running the program, as is the case with asm. Today we will see.

I know how scary assembly is if you've only heard about it. But it's not as scary as they say. I'll present everything in a very simple way so that everyone can understand what's going on and what's responsible for what.

To fully understand what is happening first I will tell you what is syscall.
By default, programs run in user space, which is a restricted execution environment where the program cannot directly access hardware resources. In user mode, a program does not have direct access I/O operations, network access, managing system processes or system files. To interact with it programs need to communicate with the kernel. A system call (syscall) is the mechanism by which a program running in user mode requests services from the kernel. e.g. *write()* used in prinf or exit() to exit process. 

In this article *sys_write* and *write()* to differentiate the real syscall from glibc function call.

I think now is a good moment to reveal that we can compile a C file without glibc that can be done with flag ```-nostdlib``` the fact is, that this program will not be simmilar to C.

```c
void _start() {
    __asm__ volatile (
        "mov $60, %rax\n"  
        "mov $0, %rdi\n"  
        "syscall"
    );
}
```
And its perf:
```java
0.06   msec task-clock:u            #    0.284 CPUs utilized
1      page-faults:u                #    16.743 K/sec
1119   cycles:u                     #    0.018 GHz
5      stalled-cycles-frontend:u    #    0.45% frontend cycles idle
0      stalled-cycles-backend:u     
6      instructions:u               #    0.01  insn per cycle
```
As we can see the result is much better than the last C static linked program, thats because we don't need glibc anymore. 

Now time for some assembly which will explain us what happened above:
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

The syscall instruction invokes the syscall with the code contained in the rax register. Then, depending on the code, arguments are required, which are successively passed in rdi, rsi, rdx, r10, r8, r9, this is the convention adopted. [here](https://x64.syscall.sh/) you can find list of all syscalls on x86-64 to see how it look like.
```java
0.10   msec task-clock:u            #    0.257 CPUs utilized
1      page-faults:u                #    9.980 K/sec
1289   cycles:u                     #    0.013 GHz
5      stalled-cycles-frontend:u    #    0.39% frontend cycles idle
0      stalled-cycles-backend:u
4      instructions:u               #    0.00  insn per cycle
```
## Understanding Program Execution in UNIX-like Systems
In UNIX-like systems, programs start execution from the *_start* function, not the *main()* function, as we are accustomed to in C. The *main()* function is essentially a wrapper, like many other components in C. Somewhere within *_start*, the *__libc_start_main* function is invoked, followed by a call to main. Here’s a simplified visualization of this process:
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

Here’s why: if you don't provide a return value, the glibc implicitly exits with 0 code. This behavior is evident when using *void main()*, we see exit call is present:
![alt text](main_no_return.png)
## glibc's Role
glibc acts as an intermediary, making system calls like *sys_write* easier to use by providing wrappers like direct *write()* or indirect *printf()*. and handling details like register saving/restoring. While direct assembly can skip some of this overhead, glibc ensures necessary things like flushing stdout, thread management, and proper exit handling, making it much more than just "redundant code."

We can bypass some of this overhead by using assembly directly. However, glibc provides far more than just convenience it also manages critical aspects like register saving and restoring during system calls. Not every syscall have it's own wrapper in glibc, that's why syscall() can call a

For example, after calling the *write()*, the program needs to continue executing correctly, so it's essential to restore the registers to avoid overwriting critical data. This isn't necessary for exit(), it's crucial for other syscalls where the program continues running.

Saying that three lines of assembly eliminate redundancy in glibc misses the broader context. glibc, which consists of hundreds of thousands of lines of code, ensures thread termination, buffer flushing (e.g., stdout), and other necessary actions before the final program exit. Skipping these operations could lead to undefined behavior or even program crashes.

so there is implemented syscall() which is doing something very important which is saving and restoring registers because in above example in rax or rdi registers could be some used by your program critical data. In terms of exit() it is not very important becasue you just want to exit process. As you can see even function call for syscalls in C are not directly calling what you want. But it is all about security and implemented features e.g. threads have to be exited before final exit of process, stdout buffer needs to be flushed. Saying that 3 lines of asssemby code just removed some redundancy in glibc is great mistake and act of disrecpect to developers of this a few hundread thousands lines of code library. 

## Glibc, glibc, libc is there sth other
[Musl](https://musl.libc.org/) is a smaller alternative to glibc (7x smaller), and it's more common to see inline assembly syscalls used there. However, glibc’s complexity supports more features and safer execution. Hope I'll write something more about it someday.

## Vicious circle

Today, going down to assembly is rarely justified when embedded devices have developed so much, where memory is no longer so limited, and clock speeds have increased so much that time is also no longer an issue. However, it is always worth being aware of how it works "under the hood"

In this article I used the expressions process and program quite interchangeably, in this context it did not have a very big meaning, but it will gain importance in my next article in which I will discuss how threads are created, what is clone() fork() exceve() pthread_create()

<span style="color:rgb(0, 152, 241)">Fun fact</span> glibc needs to use assembly because C is not able to call syscall by itself. At syscall explanation I applied simplification because write() or exit() are just wrappers for assembler calling certain syscall.