---
title: 3-tiniest-elf
date: 2024-09-27 11:03:04
tags:
- executable format
- linker
- libc
- process
- assembly
- gcc
---
In the first article you could see that the simple program int main() { return 1; } was 15776 bytes in size when statically linked and 900224 bytes in size when dynamically linked. It looks, although on today's computers these values ​​do not make any impression, but still it is surprising that a program that theoretically has several instructions weighs so much.In this article I will focus on steps to reduce the size of programs.