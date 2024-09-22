---
title: smallest-asm-program
date: 2024-09-17 14:50:52
tags:
---
As we saw recently when trying to create the shortest C program. The biggest cost in this program was glibc and its standard procedures for running the program, as is the case with asm. Today we will see.

I know how scary assembly is if you've only heard about it. But it's not as scary as they say. I'll present everything in a very simple way so that everyone can understand what's going on and what's responsible for what.

To fully understand what is happening first I will tell you what is syscall.
By default, programs run in user space, which is a restricted execution environment where the program cannot directly access hardware resources. In user mode, a program does not have direct access I/O operations, network access, managing system processes or system files. To interact with it programs need to communicate with the kernel. A system call (syscall) is the mechanism by which a program running in user mode requests services from the kernel. e.g. write() used in prinf or exit() to exit process.
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
As we can see the result is much better than the last C static linked program, thats because we don't need glibc anymore. 

<span style="color:rgb(0, 152, 241)">Fun fact</span> glibc needs to use assembly because C is not able to call syscall by itself. At syscall explanation I applied simplification because write() or exit() are just wrappers for assembler calling certain syscall.

I think now is a good moment to reveal that we can compile a C file without glibc that would be done by flag ```-nostdlib``` the fact is, that this program will not be simmilar to C.

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
In UNIX-like systems programs start execution from *_start* not *main()* function what we get used to from C. *main()* func is wrapper just like everything other in C. Somewhere in *_start __libc_start_main* is called and then main, simplified visualisation:
```json
_start:
    // rdi already contains argc (passed by kernel)
    // rsi already contains argv (passed by kernel)
    // stack already aligned somewhere

    // Call main
    call main

    // Exit
    mov rdi, rax  // Use main's return value as exit status
    mov rax, 60   // syscall number for exit
    syscall
```
If you wonder how sudenlly returned value is in rax thats beacue [calling convention](https://wiki.osdev.org/System_V_ABI).

We have passed in shortcut how return can return - because there is layer above. But do every program needs to exit? In case there would not be exit syscall, instruction pointer will jump to next address it will start to fetch, decode and execute some memory which probably would not be instrucion and fortunetlly it will cause segmentation fault. You may ask that in C you can create ```int main()``` without returning value, or even ```void main()``` (which is accepted due to backward compatibility). And the program compiles and executes completely correctly.
Here is proof that void main calls exit syscall:
![alt text](main_no_return.png)
The thing is that always you will be helped out by glibc which will just implicitly exit with 0. Behind every C function like printf, there's a deeper process of interacting with the kernel via syscalls, and glibc serves as an intermediary. We just removed this overhead by calling three instructions in assembly to bare minimum. But in glibc there are wrapper for only some of syscalls, so there is implemented syscall() which is doing something very important which is saving and restoring registers because in above example in rax or rdi registers could be some used by your program critical data. In terms of exit() it is not very important becasue you just want to exit process. But after write() syscall you want to continue program so this is very important to save and restore registers. As you can see even function call for syscalls in C are not directly calling what you want. But it is all about security and implemented features e.g. threads have to be exited before final exit of process, stdout buffer needs to be flushed. Saying that 3 lines of asssemby code just removed some redundancy in glibc is great mistake and act of disrecpect to developers of this a few hundread thousands lines of code library. 

All this is only the case in terms of glibc, [musl](https://musl.libc.org/) is doing things differently. It have to when it is 7 times smaller, but calling inline assemby to syscall is more popular there.

Today, going down to assembly is rarely justified when embedded devices have developed so much, where memory is no longer so limited, and clock speeds have increased so much that time is also no longer an issue. However, it is always worth being aware of how it works "under the hood"

In this article I used the expressions process and program quite interchangeably, in this context it did not have a very big meaning, but it will gain importance in my next article in which I will discuss how threads are created, what is clone() fork() exceve() pthread_create()