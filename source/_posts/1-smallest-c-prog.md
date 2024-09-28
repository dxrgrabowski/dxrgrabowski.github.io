---
title: "From Instruction Count to Clock Cycles: Exploring the Performance of Minimal C Program"
date: 2024-09-07 14:22:24
tags: 
- C 
- programming
- valgrind
- perf
- assembly
- linker
- libc
categories:
- Operating System Construction 
---
## Preface
I was wondering how big the overhead is before and/or after program execution. It was unreasonable to start with anything other than the simplest program with a blank `main`:
```c++
int main() { return 1; }
```
Theoretically, it is possible to compile a void main in C, which would remove the return value. However, that is not valid according to the ISO standard([C++ §3.6.1/2](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2011/n3242.pdf) | [C §5.1.2.2/1](https://www.open-std.org/JTC1/sc22/WG14/www/docs/n2310.pdf)). So we will skip it.

When we try to disassemble this code, we get assembly with 5 instructions:
```as
push    rbp      // push base pointer on stack to stabilize stack frame
mov     rbp, rsp // set base pointer on local stack pointer
mov     eax, 1   // eax commonly stores the function return value set it to 1
pop     rbp      // close the stack frame
ret              // return form procedure
```
Technically speaking, stack and stack pointer operations are not needed in this context, so the code could be reduced to:
```as
mov     eax, 1
ret
```
Now, guess how many instructions it takes to execute the above program. The answer is <span class="reveal-text" before="???" after="112 047"></span>.
This value is hard to believe, considering that the program itself is just 5 instructions. We will try to find out what and why this happens.

## Analysis Tools
Mainly two tools will be used for the analysis ```valgrind --tool=callgrind``` and ```perf```. For visualization, I used Callgrind because of its GUI tool and the greater clarity of results. The most important factor I chose was instruction count because it is machine-independent and deterministic. The runtime environment doesn't have to be exactly the same to perform profiling, which is not true for cycles, and especially for execution time.

## Callgrind Call Map & Call List of dynamically linked program
![callgrind call map](callgrind_graph_1.png)
![callgrind call list](callgrind_list_1.png)
As we can see, 98.22% of instructions were made outside of the program, in ld-linux-x86-64.so which is dynamic linux linker <span class="reveal-text" before="DLL" after="dynamic library"></span> We see methods like *_dl_sysdep_start*, *dl_start*, *dl_main*, *dl_relocate_object*, *dl_lookup_symbol_x* These are part of dynamic loading process. Their goal is to load, init, relocate and <span class="reveal-text" before="resolve symbols" after="find function and variables names"></span> used in prog contained for example from libc.so. Later we can see *handle_amd* or *handle_intel* they are involved in initialization and detection of specific processor functions (like SSE extension support, AVX, etc.) Even if your program does not use these functions directly, the system must initialize the CPU to adapt to the appropriate hardware environment. 

## Running perf stat of static & dynamic approach comparsion
Let’s run ```perf stat``` to have some unified result to compare it later
```java
0.42    msec task-clock:u              #  0.571 CPUs utilized
48      page-faults:u                  #  115.551 K/sec
331515  cycles:u                       #  0.798 GHz
16380   stalled-cycles-frontend:u      #  4.94% frontend cycles idle
1911    stalled-cycles-backend:u       #  0.58% backend cycles idle
112047  instructions:u                 #  0.34  insn per cycle
                                       #  0.15  stalled cycles per insn
22072   branches:u                     #  53.134 M/sec
1830    branch-misses:u                #  8.29% of all branches

0.000727095 seconds time elapsed
```
Okay, if most of the program time is taken up by the linker and loading dynamic libraries, let's do it statically -> ```gcc -static prog.cpp -o prog```

```java
0.21    msec task-clock:u             #  0.529 CPUs utilized
24      page-faults:u                 #  112.888 K/sec
123046  cycles:u                      #  0.579 GHz
19125   stalled-cycles-frontend:u     #  15.54% frontend cycles idle
10628   stalled-cycles-backend:u      #  8.64% backend cycles idle
26274   instructions:u                #  0.21  insn per cycle
                                      #  0.73  stalled cycles per insn
6775    branches:u                    #  31.867 M/sec
690     branch-misses:u               #  10.18% of all branches

0.000402128 seconds time elapsed
```

We can see that number of instrucions is decreased 4.26 times. However,the binary size increased from <span style="color:green">15776</span> to <span style="color:red">900 224</span> bytes, which is huge difference (<span class="reveal-text" before="x57" after="5706%"></span>). This is because the libraries that were previously dynamically linked from the system are now stored in the binary code of the program.

## Callee List of statically linked program
![callee list](callgrind_list_2.png)
I won't paste the glibc library code here for the sake of cleanliness. But as you can see, the __tunables_init function is the main culprit. The main purpose of this function is to allow you to configure the behavior of the glibc library via environment variables. This allows you to customize certain aspects of the library’s behavior without having to recompile your program. A minimum set of these variables must be initialized because the C runtime doesn’t know in advance that your program is just a blank main function and won’t use most features, so it prepares for all possibilities.

## CPU and Memory Tunables
For example, there are tunables related to the CPU and memory management. CPU variables such as cache size and thresholds for optimized copy instructions must be set, regardless of the actual CPU manufacturer. This explains why functions such as *handle_intel* and *intel_check_word* are called, even though both my PC and WSL are Ryzen. Their total of 19% can be partly justified by querying hardware or system constants.

Equally important are the variables related to memory management, particularly the entire set of glibc.malloc variables. These parameters control key aspects of memory allocation, such as the size and number of memory arenas, the thresholds for using mmap instead of sbrk, and the behavior of the thread cache. For example, glibc.malloc.arena_max can significantly affect memory usage on multi-core systems, while glibc.malloc.mmap_threshold determines when the system will use mmap to allocate larger blocks of memory.

All tunables you can find [here](https://www.gnu.org/software/libc/manual/html_node/Tunables.html) or by calling ```/lib64/ld-linux-x86-64.so.2 --list-tunables```

## Conclusion
This is my first technical article. It was intended to illustrate the differences between dynamic and static linking, more or less show the costs and benefits of each, and explain why it happens and what is responsible for it.

 In the next one, we will dive deeper into C compiled without glibc and explore the shortest program in assembly and its binary. I really appreciate any feedback, so if you have any comments or suggestions, feel free to leave a comment below ⬇️.
