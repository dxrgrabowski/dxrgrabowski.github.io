---
title: The Art of Creating Minimal ELF64 Executables in the Modern Era
tags:
  - executable format
  - linker
  - libc
  - process
  - assembly
  - gcc
  - elf64
date: 2024-09-27 11:03:04
---
## Preface
In the first article, you could see that the simple program:
```c
int main() { return 1; }
```
Was 15776 bytes in size when dynamically linked and 900224 bytes in size when statically linked. Although on today's computers, these values ​​do not make any impression, still it is surprising that a program that theoretically has several instructions weighs so much. This article delves into the techniques for creating extremely tiny ELF64 (Executable and Linkable Format 64bit) executables on Linux systems.

### C specifics
Unfortunately, in the case of C, the options are quite limited. At some point, we would conclude that it would actually be best to do inline assembly, start the function with _start, and compile with flag -nostdlib and -nostartfiles. For such an application, we could use a lighter library adapted to embedded systems. Like [uClibc](https://uclibc-ng.org/), written for a very limited Linux without MMU or other libraries typically for microcontrollers, such as [newlib](https://sourceware.org/newlib/) or its descendant [picolibc](https://github.com/picolibc/picolibc), it still won't get us as close to a minimal elf64 as asm. 
### Glibc 
Today, glibc is used in most cases, because most Linux distros contain it. But it wasn't always like that, Debian used eglibc in the years 2009-2015. The situation was mainly due to the organizational structure of glibc and the fact that it was considered insufficiently adapted to embedded systems or ARM. [Here](https://ecos.sourceware.org/ml/libc-alpha/2002-01/msg00079.html) is the correspondence where Linus complains about glibc and calls it "bloated". I will briefly present the procedure in the case of C and as soon as possible slide into our beloved Assembly.
### How this could differ to other pc
As the number of executed instructions could be relatively deterministic, the size of the elf file will be very dependent on the machine, installed library versions, and other factors. Of course, going lower and lower with values between different machines, at some point the values will start to be the same, as we get rid of some external dependencies.
### Intel vs AT&T syntax
At the very beginning, I will state that Assembly has two syntaxes AT&T and Intel, they are completely incompatible, the order of operands, register prefixes, and number prefixes are different. I will use Intel to be compatible with nasm.

## What steps we can make in C to reduce file size
The obvious first step is stripping the executable by adding ```-s``` which in our case will remove sections containing symbols .strtab and .symtab which are not needed in execution. After this step ```-flto``` will do nothing same as optimizations. The next possible move is to use ```-Wl,--gc-sections``` which is just a garbage collector but for sections during the linking process.

```json
-rwxr-xr-x 1 dxr dxr 15776 default       // gcc -o default main.c 
-rwxr-xr-x 1 dxr dxr 15744 flto          // -flto
-rwxr-xr-x 1 dxr dxr 14328 stripped      // strip --strip-all default
-rwxr-xr-x 1 dxr dxr 14328 s             // -s
-rwxr-xr-x 1 dxr dxr 14328 s-o3          // -s -o3
-rwxr-xr-x 1 dxr dxr 14328 s-o3-flto     
-rwxr-xr-x 1 dxr dxr 14248 s-o3-flto-gc  // -s -o3 -flto -Wl,--gc-sections
```
These are the simplest techniques, without interfering too much with the program. From a certain point on, it starts to be more of a fight for bytes than writing a program; therefore, if someone is fighting such a fight, it is rather certainly already in Assembly, which we will also do below. For the curious, the next steps without inline asm would be to try to link object files with libraries and disable paging. Also removing unnecessary sections, which would be removed for us by a custom linker script, which would also combine all sections and make one segment.
## Assembly
We will jump straight to assembling with nasm and linking with ld to speed up a little. 
```json
section .text
    global _start

_start:
    mov rax, 60    
    mov rdi, 1      
    syscall
```
after calling ```nasm -f elf64 small.asm``` and  ```ld -s small.o``` we get:
```json
-rwxr-xr-x 1 dxr dxr 4320 a.out
```
4320 bytes is a lot for such a small program, especially in asm without library overhead. In the above case, we are using 64 bit registers, changing to ax and di, i.e. 16-bit registers instead of 64-bit rax and rdi, does not make any difference in the output file a.out. Even though by calling ```objdump -x a.out``` we can see that the size of the .text section decreases from 12 to 10 bytes. This is because the sections are aligned to 16 bytes == 2**4
```json
Sections:
Idx Name          Size      VMA               LMA               File off  Algn
  0 .text         0000000c  0000000000401000  0000000000401000  00001000  2**4
                     /\
                     /\
  this value decreases but exe file size does not shrink
```
## Memory Alignment in Sections and Segments
This is because the sections are aligned to 16 bytes == 2**4. This means that it doesn't matter if the value is 2, 12 or 15, this section will have the same size. You may immediately wonder why it is constructed this way and why 2**4 and 2**12, well, read further.

Let's look at ```readelf -lSW a.out``` it, will show a little bit more info:
```json
Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .text             PROGBITS        0000000000401000 001000 000009 00  AX  0   0 16
  [ 2] .shstrtab         STRTAB          0000000000000000 001009 000011 00      0   0  1
Key to Flags:
  A (alloc), X (execute)

Elf file type is EXEC (Executable file)
Entry point 0x401000
There are 2 program headers, starting at offset 64

Program Headers:
  Type           Offset   VirtAddr           PhysAddr           FileSiz  MemSiz   Flg Align
  LOAD           0x000000 0x0000000000400000 0x0000000000400000 0x0000b0 0x0000b0 R   0x1000
  LOAD           0x001000 0x0000000000401000 0x0000000000401000 0x000009 0x000009 R E 0x1000

 Section to Segment mapping:
  Segment Sections...
   00
   01     .text
```
We see two memory segments typed LOAD, which are intended to be loaded into memory once memory is allocated for them. 

The first one is <span class="reveal-text" before="0xB0" after="176 bytes"></span>. Which mostly holds the ELF header. It will allow the system to identify that it is an elf file or go to the entry point address and the program header, which will be used immediately after to allocate memory space for the segments.

The second is 9 bytes, which is .text (code) section. Mapped to a segment with 2**12 alignment. We can also see that in addition to the R (READ) flag, there is also an E (Execute) which, together with the fact that the Entry point holds its address and Section to Segment mapping, confirms that this is the code. 

Segments are mapped with 2**12 tonicity, which is a typical 4096 bytes, which is used for paging virtual memory (RAM). It is ideal to choose a value that fits within the page boundaries. Even if there is a bit too much memory redundancy to achieve maximum speed.

Sections are mapped to segments only for the purpose of loading into memory. Sections and their information are more important to the processor itself, they are made to organize code and data. The .text (code) section will certainly be used very intensively, i.e. it will be placed as close to the CPU as possible. These will be cache memories, which are often paged by 16 bytes. It could also be 4, 8, or 32, but picking the value 16 is a typical alignment on x86_64. It will also mean less memory usage and space savings. The cache memory is valuable, and its optimal use is very significant.
### Modifying and removing alignment
Linker set the default alignment to 1000 for segments. By calling ```ld -z max-page-size=0x1 -s small.o``` we can manipulate this value. But still, the best solution would be to get rid of page alignment altogether. This will provide us with the ```-n / -nmagic``` option of calling it combined with strip ```ld -n -s``` we get such executable (reduced for clarity):
```json
Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .text             PROGBITS        0000000000400080 000080 00000a 00  AX  0   0 16
  [ 2] .shstrtab         STRTAB          0000000000000000 00008a 000011 00      0   0  1

Entry point 0x400080
There is 1 program header, starting at offset 64

Program Headers:
  Type           Offset   VirtAddr           PhysAddr           FileSiz  MemSiz   Flg Align
  LOAD           0x000080 0x0000000000400080 0x0000000000400080 0x00000a 0x00000a R E 0x10

 Section to Segment mapping:
  Segment Sections...
   00     .text
```
By using these steps, we are able to go down to 352 bytes:
```bash
$ wc noalg-strip
  352 noalg-strip
```
### Custom linker script
I think this is a good time to mention that we can create our linker script.
```
ENTRY(_start)
SECTIONS
{
    . = 0x100e8;    // Set location counter 
    .all : {
        *(.text*)   // Pack everything into .all section
    } :code 
    .shstrtab : { 
       *(.shstrtab) // Explanation below
    }
    /DISCARD/ : {   // Discard all other sections
      *(*)
    }
}
PHDRS
{
  code PT_LOAD FILEHDR PHDRS ;
}
```
The `.` section is irrelevant to our program, but we need to specify its address so that the linker knows where to put the headers. 
### .shstrtab
While trying to remove the .shstrtab section with ``objcopy --removesection`` or with ``strip -R`` nothing changed. Likewise, GNU Linker (ld) did not respond to discard this section, it just inserted it. LLVM linker (ld.lld), on the other hand, informs us with the following error message: discarding .shstrtab section is not allowed. 

The .shstrtab section is mandatory because the section names are stored as references to this section name table. So as long as there is at least one section in an ELF file, there must be a .shstrtab section.

This allowed us to go down another 8 bytes:
```bash
$ wc noalg-strip-T-super
  344 noalg-strip-T-super
```
## Why do we need sections per se then, let's try to have some fun.

[There](https://uclibc.org/docs/elf-64-gen.pdf) is a great document that describes the elf64 structure. We can specify that the ELF header is at offset 0x0 and is 64 bytes, and the Program Header is 56 bytes with offset specified in one of EHDR fields, but preferably after EHDR.
### ELF64 Before
![alt text](hexyl-before.png)

### EHDR fields needed for modification
The fields we will need to modify in EHDR are:
- e_entry (Entry point address) now (0x0100f0):
  - Specifies where the _start would be; we set it to 0x400080 right next to PHDR  
- e_shoff (Section Header Offset) now (0x98):
  - Specifies the offset to the section header table in the file.
  - Since we are removing section headers, we set this to 0x0 (no section headers).
- e_shentsize (Section Header Entry Size) now (0x40):
  - It determines the size of each section header entry.
  - We set the value to 0x0000 (no section headers).
- e_shnum (Number of section header entries) now (0x03):
  - This field specifies the number of section header entries.
  - We set to 0x0000 (no section headers).
- e_shstrndx (Section Name String Table Index) now (0x02):
  - Specifies the index of the section header string table that contains section names.
  - Since there are no section headers, we set this value to 0x0 (no string table).

### PHDR fields needed for modification
The fields we will need to modify in PHDR are:
- p_offset (Offset in the file) now (0x0):
  - This represents where the segment starts in the file. We will have only one segment with a code, we set it to 0x80
- p_vaddr (Virtual address in memory):
  - This is where the segment will be loaded into memory. You can choose a reasonable virtual address, typically aligned, like 0x400080 (just after the headers, matching the p_offset).
- p_paddr (Physical address):
  - This is generally ignored for most modern systems, so you can either mirror p_vaddr or set it to 0x0.
- p_filesz (Size of the segment in the file):
  - This should be the size of the code segment you're keeping, not including the ELF header or program header.
  - For instance, our code is 10 bytes, we set this to 0xA.
- p_memsz (Size of the segment in memory):
  - This should match p_filesz if the segment size in memory is the same as the file size (which is typical for a simple executable).
  - The code size is 10 bytes, we set this to 0xA.

We can delete everything that is after our code. 
### Final result
![alt text](hexyl-after.png)
I edited the values using ghex, saved the file. The system has no idea it is an elf64 file and is executable, so we add a flag with the ```chmod +x``` command. And we can check if the program works as intended and check the size:
```bash
$ ./noalg-strip-T-super-PH-align ; echo $?
  1
$ wc noalg-strip-T-super-PH-align
  138 noalg-strip-T-super-PH-align
```
### Removing alignment
This is already very good, recall that EHDR 64 + PHDR 56 = 110 with code + 10 = 130. Why the remaining 8. That's because we still did not get rid of alignment.

We have to change: 
- e_entry
- p_offset
- p_vaddr
- p_paddr
- p_align (Alignment of the segment) now(0x10):
  - For minimal alignment, we can use 0x1.
  
![alt text](hexyl-noalign.png)

## Reducing instruction size
Now we have only EHDR, PHDR and code, it's 130 bytes. It's always the case that if you think something is close to being over, you're probably halfway through something that someone has already figured out. In computer science, this is a common feeling. So too in this case, still this file can be reduced. It's not surprising that we can select the exact instructions that have as few bytes as possible in optcode.

```json
// Old code
66 b8 3c 00   mov    ax,0x3c
66 bf 01 00   mov    di,0x1
0f 05         syscall

// New code
31 ff         xor    edi,edi
6a 3c         push   0x3c
58            pop    rax
0f 05         syscall
```
Just by changing instructions, we are able to cut 3 bytes. Fun fact `xor di, di` and `xor rdi, rdi` are 3 bytes, `xor edi, edi` is the best 2-byte choice. The mov instructions are very expensive, so it makes sense to replace them with a stack. Here it is similar, pop rax is the best choice over other parts of this register.
![alt text](hexyl-noalign-instruction.png)
## Embedding the Code in the ELF Header
The ELF64 format does not define where the code and even the Program Header should be. As you can see, of the 16 bytes of the EHDR header, as many as 8 bytes are unused. This is the perfect place to fit our code!
![alt text](hexyl-noalign-instruction-embed.png)
Now we are at 120 bytes and of course while calling `readelf -a` we will see our code:
```json
$ readelf -lSaW shortest
  ELF Header:
    Magic:   7f 45 4c 46 02 01 01 00 31 ff 6a 3c 58 0f 05 00
    Class:                             ELF64
```
but it's not a problem for readelf to define that it's ELF64 file.

## Conclusion 
Delving into the alignment mechanism allowed us to see what memory sacrifices are used today to achieve speed. This could not have happened at once; over the years, as technology progressed, the capacity of specific memories increased, and speed sacrifices may have been made. The techniques presented in this article are more of a curiosity than a guide. Rarely is such a reduction in executable file size needed these days. 
### During the writing thoughts
I had a hard time sensing a line anywhere where I should describe something more broadly and discuss it in detail; I apparently have yet to sense the target audience. Often, too, when exploring a topic and going down with an article, I had to go back up, reworking it after gaining a broader perspective. I'm not sure if the article didn't come out too long, I had the thought of breaking it into two parts.
## What next?
In this article I used the expressions "process" and "program" quite interchangeably, in this context it did not have a tremendous meaning, but it will gain importance in my next article in which I will discuss how threads are created, what is clone() fork() execve() or pthread_create().
<details>
<summary><span style="color:rgb(0, 152, 241)">Sources</span></summary>
https://uclibc.org/docs/elf-64-gen.pdf
https://lld.llvm.org/
https://stackoverflow.com/questions/39960434/linux-elf-file-sections-name
https://stackoverflow.com/questions/65719528/why-is-shstrtab-section-mandatory
https://stackoverflow.com/questions/31453859/how-to-remove-a-specific-elf-section-without-stripping-other-symbols
https://hackmd.io/@brlin/orncb-ld-manual/https%3A%2F%2Fsourceware.org%2Fbinutils%2Fdocs-2.32%2Fld%2FLocation-Counter.html
</details>