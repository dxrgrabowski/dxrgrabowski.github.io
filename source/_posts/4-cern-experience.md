---
title: "My CERN Experience"
date: 2025-11-27 10:00:00
categories:
- Lifestyle
tags:
- CERN
- research
- python
- programming
- ceph
---
# My CERN Project: A Summer of Storage, Science, and Exploration

As my contract with the 2025 CERN openlab summer programme concluded, I've been reflecting on the entire experience. It began with the incredible news of being selected as one of 38 participants from over 3,800 applicants. It ended with me delivering a functional proof of concept for CERN's storage infrastructure and a collection of unforgettable memories.

This article is a summary of both my technical project and the personal journey that came with it.

## The Technical Challenge: Data Consistency at Petabyte-Scale

CERN's experiments, particularly the Large Hadron Collider (LHC), generate petabytes of data that must be stored and preserved for the long term. To do this, CERN relies on **Ceph**, an open-source distributed storage system.

To ensure high availability and disaster recovery, Ceph's RADOS Gateway (RGW) is deployed in a **multisite configuration**, replicating data between different data centers (e.g., in Meyrin and Prévessin).

While this asynchronous replication is great for performance, it introduces a significant risk: **data inconsistency**. Due to network latency, service failures, or software bugs, data can become inconsistent—it might exist at one site but be missing or outdated at another. These errors can be "silent" and incredibly difficult to detect, potentially leading to data loss.

### My Solution: The Ceph RGW Multisite Consistency Monitor (☣️TECHNICAL content WARNING☢️)

Reading the entire cluster from the objects it holds is a very expensive process. My solution is an iterative, consistent data collection approach using lightweight Kafka notifications.

To address this, I designed, implemented, and documented the **Ceph RGW Multisite Consistency Monitor**. This is a comprehensive tool built to detect, diagnose, and report on these replication discrepancies.

The tool operates in two distinct modes, providing both passive validation and active testing:

### 1. Active Testing Mode

This mode is designed to stress-test the replication pipeline and validate its correctness under a controlled load.

**Workflow:**
1.  **Generate Load:** The tool performs a configurable number of S3 `PUT` operations to create new objects in the primary cluster. It can also work in continuous mode
2.  **Wait for Sync:** For each object there is (`object_lifetime_seconds`) to allow time for the asynchronous replication to complete.
3.  **Clean Up:** It then issues `DELETE` operations for objects it created.
4.  **Analyze:** The monitor compares the "ground truth" (the set of S3 operations it performed) against the stream of Kafka notifications it received from *all* sites.
5.  **Report:** It generates a detailed report pinpointing exact inconsistencies, such as "Missing PUT Notifications", "Extra DELETE Notifications", or "Orphaned Sync Events". 

### 2. Passive Monitoring Mode (The main goal)

This mode is non-intrusive and designed to monitor a live, production environment without generating its own traffic.

**Workflow:**
1.  **Listen:** The tool connects to Ceph's Kafka-based bucket notification system and continuously consumes the real-time stream of S3 event notifications.
2.  **Detect:** It parses these events to find logical errors as they happen.
3.  **Flag:** It can immediately identify issues like an `ObjectSynced:Create` event appearing for an object that never had a primary `ObjectCreated:Put` event.
4.  **Log:** All findings are logged in real-time to an `inconsistencies.jsonl` file for administrators to review. It can be synchronized with monitoring tools like Graphana or Prometheus

### Final report

[I summarized my work in a scientific report that was published on Zenodo](https://zenodo.org/records/17063247). [HERE](https://zenodo.org/records/17063247)

---

## Beyond the Code: The Full CERN Experience 

My summer at CERN wasn't just about the project; it was about the incredible, immersive environment. I had the privilege of meeting and collaborating with brilliant people from all over the world, each working on a different, fascinating piece of the CERN puzzle.

The environment at CERN is unlike anywhere else. I had the chance to see multiple experiments and control centers up close. This included tours of the **Antimatter Factory**, **LEIR**, **ISOLDE**, massive **ATLAS** experiment and more. Some ISR tunnels expeditions, seeing the complex machinery that scientists use to probe the fundamental structure of the universe. What made these visits truly special was the ability to *touch* some of the components, grounding the immense scale of the science in something tangible.

The campus itself is steeped in history. I was able to stand in the very **office where the World Wide Web was born** and visit the **600 MeV Synchrocyclotron (SC)**, one of CERN's first accelerators.

![LEIR](LEIR.jpg)

### The OQI Hackathon 💫

My experience wasn't just limited to my project and tours. From 11-13 July, I joined 34 other students from over 20 countries at CERN IdeaSquare for a hackathon co-organised by OQI and the University of Geneva.

The challenge? To explore how quantum computing could be used to design new **quantum materials** and contribute to the UN's Sustainable Development Goals (#SDGs). Quantum materials, like graphene, display unique properties due to quantum mechanics and are used in everything from batteries to touchscreens. It was a fantastic deep-dive into an emerging field, working collaboratively on complex problems. 🌍

My team achieved 1st and 2nd place in two competitions among 6 teams 🥰

![hackaton](hackaton.jpg)

### Education at CERN

In addition, I had the opportunity to participate in many workshops and lectures. For example, Nvidia gave a lecture on Cuda programming and deep learning. We conducted an experiment with shooting particles in a Wilson chamber. I significantly expanded my knowledge of how the world works at the atomic level, what the Higgs boson is, different types of radiation, how it affects electronics, and I could go on and on.

### Life and Travels

Living in the Geneva area, straddling the border of France and Switzerland, was an experience in itself. I took full advantage of the local culture, enjoying **great French food and wines** (I started to love Buffets!)... 

![Buffet](Buffet.jpg) 

and spending a huge amount of time **bike riding** through the beautiful landscapes of the Pays de Gex, around Lake Geneva and also in the surrounding swiss villages.

![Bike in park](bike.jpg)

The location is a perfect gateway for exploring. On the weekends, I was able to:
* Hike in the Alps, including an unforgettable trek to **Col du Belvédère (2780m)** near Chamonix, with its stunning views of the Mont Blanc massif.

![Col du Belvédère](colDuBelv.jpg)

* Relax by the lakes, including a beautiful trip to **Lugano** in the Italian-speaking part of Switzerland.

![Lugano](lugano.jpg)

* Explore historic cities. I managed to visit the beautiful canals of **Annecy**, the gastronomic capital of **Lyon**, and the Swiss cities of **Zurich** and **Bern**.

![Zurich](Zurich.jpg)

And much more, such as various lakes in the Swiss Alps, trekking in the Jura Mountains, the most beautiful Swiss valley of Lauterbrunnen, Interlaken, Via Ferrata, and more. Importantly, I tried to be in a new place every weekend to make the most of my time. I could be in the depths of France one afternoon and in Zurich the next day, a difference of several hundred kilometers, all by public transport/BlaBlaCar, and I often slept for 4 hours between two trips!

---

## Key Achievements and Lessons Learned

This project was a success, delivering a robust, flexible, and performant tool that met all its core requirements. But the development process itself was a powerful learning experience.

* **Know your tool's limits:** The pure Python implementation struggled with high-frequency event streams in passive mode. Migrating the performance-critical, real-time parsing logic to a dedicated **C++ component** was the right solution, creating a fast and resilient hybrid system.
* **Define and defend your scope:** The project's scope expanded significantly from a simple listener to a full-fledged testing platform. Learning to manage this "scope creep" by prioritizing "Must-Have" features is essential for delivering on time.

This summer at CERN has been the most challenging and rewarding period of my career so far. I'm leaving with a new set of technical skills, a deeper appreciation for large-scale scientific collaboration, and a list of new friends from around the world. A beautiful, very intense experience that I will not forget for a long time especially those crazy, lucky ducks:

![duck](duck.jpg)