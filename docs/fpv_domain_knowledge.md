# FPV Drone Domain Knowledge

> Comprehensive reference for FPV drone part compatibility, naming conventions, and build rules.
> Built through hands-on analysis of 3,000+ products from major FPV retailers (GetFPV, RotorVillage).
> Intended audience: developers building compatibility tools, AI agents assisting drone builders.

---

## 1. What Is an FPV Drone Build?

An FPV (First Person View) drone is a custom-built multirotor aircraft flown via a live video feed from an onboard camera to pilot goggles. Unlike consumer drones (DJI Mavic, etc.), FPV drones are assembled from discrete components that must be physically and electrically compatible.

### Core Components (every build needs these)

| Component | Role | Key Compatibility Factors |
|---|---|---|
| **Frame** | Carbon fiber skeleton holding everything together | Prop size, motor mount pattern, FC stack mount pattern |
| **Motors** (x4) | Spin the propellers | Stator size, KV rating, shaft diameter, motor mount bolt pattern |
| **Propellers** (x4) | Generate thrust | Diameter, pitch, shaft hole size, blade count |
| **ESC** (Electronic Speed Controller) | Controls motor speed from FC signals | Current rating, voltage range, mounting pattern, firmware |
| **Flight Controller (FC)** | The brain -- runs flight firmware (Betaflight/iNav/ArduPilot) | MCU chip, mounting pattern, gyro/IMU sensor |
| **Battery** | Power source (LiPo) | Cell count (voltage), capacity (mAh), connector, C-rating |
| **FPV Camera** | Captures video for the pilot | Analog vs digital system, sensor size, lens FOV |
| **Video Transmitter (VTX)** | Broadcasts video to goggles | Video system (must match camera + goggles), power output |
| **Receiver (RX)** | Receives pilot control inputs from transmitter | Protocol (ELRS, Crossfire, FrSky, etc.) |

### Optional Components
- **GPS Module** -- Position hold, return-to-home, rescue mode
- **Antennas** -- VTX antenna (video), RX antenna (control link)
- **Buzzer** -- Lost-model alarm
- **Capacitor** -- Voltage smoothing on ESC/battery connection

### Common Configurations
- **Stack** = FC + ESC sold together, pre-matched for mounting and wiring
- **AIO (All-In-One)** = FC with built-in ESC (and sometimes VTX + RX), common on small builds
- **Standalone FC** = Just the flight controller board, paired with a separate ESC

---

## 2. Size Classes

FPV drones are categorized by propeller size. Each size class has natural component pairings that have been standardized by the community over years. This is THE fundamental organizing principle for compatibility.

| Size Class | Prop Size | Typical Motors | Cells | Motor Mount | FC/ESC Mount | Typical Use |
|---|---|---|---|---|---|---|
| **Tiny Whoop** | 31-40mm | 0702-0803 | 1S | 6.6mm / M1 | AIO only | Indoor, ducted |
| **2 inch** | 2" | 1102-1204 | 1S-2S | 9mm / M2 | 16x16, 20x20 | Micro outdoor |
| **3 inch** | 3" | 1303-1507 | 1S-4S | 9-12mm / M2 | 20x20, 25.5x25.5 | Cinewhoop, light freestyle |
| **3.5 inch** | 3.5" | 1404-1806 | 3S-6S | 12-16mm / M2-M3 | 20x20, 25.5x25.5 | Versatile middle ground |
| **4 inch** | 4" | 1806-2006 | 4S-6S | 12-16mm / M2-M3 | 20x20, 25.5x25.5 | Light cinelifter |
| **5 inch** | 5" | 2205-2407 | 4S-6S | 16mm / M3 | 25.5x25.5, 30.5x30.5 | **The standard** -- freestyle, racing |
| **6 inch** | 6" | 2207-2408 | 4S-6S | 16mm / M3 | 30.5x30.5 | Long range, smooth cinema |
| **7 inch** | 7" | 2506-2809 | 6S | 16-19mm / M3 | 30.5x30.5 | Long range cruiser |
| **8-10 inch** | 8-10" | 2809-4014+ | 6S-12S | 19mm / M3-M4 | 30.5x30.5 | Heavy lift, X-Class racing |

**5-inch is king**: The vast majority of FPV builds are 5-inch. It's the sweet spot for power, agility, and parts availability. Most FPV retailers stock 5-inch components most heavily.

### Size Class Assignment Logic
- **Frames**: Determined by max prop size the frame supports
- **Motors**: Determined by stator size (see motor section below)
- **Props**: Determined by diameter
- **ESCs/FCs/Stacks**: Determined by mounting pattern + voltage range
  - 20x20 + 1-2S = 2-3 inch class
  - 25.5x25.5 + 3-6S = 3.5-5 inch class
  - 30.5x30.5 + 4-6S = 5-7 inch class
- **Batteries**: Determined by cell count + capacity
  - 4S 1300-1800mAh = 5 inch
  - 6S 1050-1550mAh = 5-7 inch
  - 6S 2200mAh+ = 7-10 inch
- **Cameras, VTX, RX, GPS, Antennas**: Universal (work across all sizes)

---

## 3. Component Deep Dives

### 3.1 Motors

**How they work**: Brushless outrunner motors. The bell (outer shell) spins around the stator (inner windings). Stator size determines power output; KV determines RPM-per-volt.

#### Stator Size Coding
The stator code is a 4-digit number encoding diameter and height in millimeters:
- Format: `DDMM` where DD = diameter (mm), MM = height (mm)
- Example: `2207` = 22mm diameter, 07mm height
- Example: `1404` = 14mm diameter, 04mm height

Bigger stator = more torque. Taller stator = more RPM headroom.

#### Stator-to-Size-Class Mapping
| Stator Range | Size Class | Shaft | Motor Mount |
|---|---|---|---|
| 0702-0803 | Tiny Whoop | 1.0mm | 6.6mm / M1 |
| 1102-1204 | 2 inch | 1.5mm | 9mm / M2 |
| 1303-1507 | 3 inch | 1.5mm | 9-12mm / M2 |
| 1404-1806 | 3.5-4 inch | 1.5-5mm | 12-16mm / M2-M3 |
| 2205-2407 | 5 inch | 5mm | 16mm / M3 |
| 2207-2408 | 5-6 inch | 5mm | 16mm / M3 |
| 2506-2809 | 7 inch | 5mm | 16-19mm / M3 |
| 2809-4014 | 8-10 inch | 5mm | 19mm / M3-M4 |

#### KV Rating
- KV = RPM per volt (unloaded)
- **Higher KV** = higher RPM = more aggressive/racing feel
- **Lower KV** = more torque per RPM = better efficiency, smoother
- 5-inch typical: 1700-2600KV on 6S, 2300-2750KV on 4S
- Inverse relationship with cell count: higher voltage -> lower KV needed

#### Product Name Conventions
- Standard: `Brand Model 2207-1900KV`
- Letter prefix: `SE0702`, `RS1102`, `EX2207` (prefix is just a product line identifier)
- Axisflying C-notation: `C206` = 2006 stator (C + D0M → DD0M)
- T-Motor F-series: `F2203.5` = 2203 stator (ignore decimal in height)
- Known model lookups (name doesn't contain stator):
  - F40 Pro = 2306, F60 Pro = 2207, F80/F90 = 2806.5
  - MCK V2 = 2306, Stout Motor = 2306
  - Velox V3 = 2207, Xing2 = 2207

#### Motor Mount Patterns
- The motor physically bolts to the frame arm via 4 screws in a square pattern
- **Spacing** is the distance between bolt holes (6.6mm, 9mm, 12mm, 16mm, 19mm)
- **Bolt size** is the screw diameter (M1, M2, M3, M4)
- These MUST match the frame's arm motor mount holes (hard constraint)

---

### 3.2 Frames

**What they are**: Carbon fiber structures (sometimes plastic for tiny whoops). Arms extend from a center stack area to hold motors. The center has mounting holes for the FC/ESC stack.

#### Key Specs
- **Prop size**: The maximum propeller the frame can physically fit (frame arm length determines this)
- **Wheelbase**: Diagonal motor-to-motor distance in mm (e.g., 225mm for typical 5-inch)
- **FC mounting patterns**: Hole patterns in the center for mounting FC/ESC (20x20, 25.5x25.5, 30.5x30.5 mm)
  - Many frames support MULTIPLE patterns (e.g., both 20x20 and 30.5x30.5)
- **Motor mount**: Bolt pattern on each arm tip (spacing + bolt size)
- **Arm thickness**: Affects durability and weight (3mm, 4mm, 5mm, 6mm common for 5-inch)
- **Camera mount**: Standard 19mm width for micro cameras, some support 20mm "DJI" cameras

#### Product Name Conventions
- Explicit prop size: `5"`, `7"`, `3.5"` in the name
- Model number encoding: `Mark5` = 5", `AOS 5` = 5", `FIFTY5` = 5"
- Divide-by-10 model numbers: `Cinelog25` = 2.5", `SmolYeet35` = 3.5", `Pavo20` = 2.0"
- Known model lookups: `Vapor D5` = 5", `Creamer` = 5", `MOPAX` = 5"
- Whoop sizes in mm: `Mobula6` = 65mm, `Meteor75` = 75mm
- DJI compatibility markers: `O3` or `O4` in name means DJI digital video compatible mounting

#### Frame Material
- **Carbon fiber**: Standard for 3"+, varies in quality (T300, T700, T800 grades)
- **Plastic/TPU**: Whoops, some 2-3" frames, 3D printed mounts
- **Aluminum**: Rare, some CNC builds

---

### 3.3 Propellers

**Critical sizing**: Propeller diameter determines the size class. Pitch affects thrust and efficiency.

#### Naming Conventions (this is complex)
Propeller naming varies wildly between manufacturers:

| Format | Example | Parsed As |
|---|---|---|
| Gemfan 5-digit | `51433` | 5.1" dia, 4.3" pitch, 3 blades |
| Gemfan 4-digit | `6026` | 6.0" dia, 2.6" pitch, 2 blades (implied) |
| HQ Prop format | `5x4.3x3` | 5" dia, 4.3" pitch, 3 blades |
| HQ Prop format | `5.1X3.1X3` | 5.1" dia, 3.1" pitch, 3 blades |
| T-mount prefix | `T5143` | T-mount hub, 5.1" dia, 4.3" pitch, 3 blades |
| Folding prefix | `F1051` | Folding, 10" dia, 5.1" pitch |
| 3D suffix | `493D` | 4.9" dia, 3D (symmetric pitch) |
| LR prefix | `LR5126` | Long range, 5.1" dia, 2.6" pitch |
| Whoop (mm) | `31mm`, `40mm` | Diameter in millimeters |
| S suffix | `51433S` | 5.1" dia, 4.3" pitch, 3 blades (S = model variant) |

#### Shaft Hole / Hub Types
The prop must physically fit onto the motor shaft:
- **5mm center hole**: Standard for all 5"+ props. Fits 5mm motor shafts directly.
- **1.5mm press-fit**: Whoop/micro props, press onto 1.5mm shaft
- **1.0mm press-fit**: Tiny whoop props, press onto 1.0mm shaft
- **T-mount**: Hubless design, props screw onto T-mount adapter on motor shaft. Universal compatibility with any motor that has a T-mount adapter.
- **M5 threaded**: Prop screws onto threaded motor shaft (less common now)

#### Blade Count
- **2-blade (biblade)**: Fastest, least drag, most efficient, harshest sound
- **3-blade (triblade)**: The standard for 5-inch freestyle/racing. Best thrust-to-drag balance.
- **4-blade+**: Maximum grip, loud, power-hungry. Used for heavy cinema rigs.

---

### 3.4 Electronic Speed Controllers (ESCs)

**Role**: Takes throttle commands from the FC and converts them into the 3-phase AC signals that drive the brushless motors. Modern FPV ESCs are virtually all "4-in-1" — a single board controlling all 4 motors.

#### Key Specs
- **Continuous current rating** (per motor): 25A, 35A, 45A, 55A, 65A, 80A
  - Rule of thumb: ESC current should be ~1.5x the motor's max continuous draw
  - 5-inch builds: 35-55A typical
  - 7-inch: 55-65A
  - Micro: 5-12A
- **Voltage range**: Expressed as cell count (e.g., "3-6S" = supports 3S through 6S batteries)
- **Mounting pattern**: 20x20mm or 30.5x30.5mm (must match frame's FC mounting)
- **Firmware**: Software running on the ESC MCU
  - **BLHeli_S**: Legacy 8-bit, basic, cheap. Being replaced.
  - **Bluejay**: Open-source BLHeli_S fork with extra features
  - **BLHeli_32**: 32-bit, configurable, reliable. Industry standard.
  - **AM32**: Open-source 32-bit alternative to BLHeli_32. Growing popularity.
  - **FETtec**: Premium 32-bit firmware with telemetry
- **Protocol**: How FC talks to ESC
  - DShot150/300/600/1200: Digital protocol, no calibration needed
  - DShot600 is standard for most builds

#### 4-in-1 vs Individual ESCs
- **4-in-1**: Single board, 4 motor outputs. Standard for 90%+ of builds. Stacks with FC.
- **Individual ESCs**: One per arm. Used for very large builds or when arm ESCs are preferred.
- **AIO**: ESC built into the FC board. Common on sub-3-inch builds.

---

### 3.5 Flight Controllers (FCs)

**Role**: The brain of the drone. Reads gyro/accelerometer data, processes pilot inputs from the RX, computes motor outputs, and sends throttle commands to the ESC. Runs flight firmware (Betaflight, iNav, KISS, or ArduPilot).

#### MCU Families (the processor chip)
| MCU | Architecture | Clock | Notes |
|---|---|---|---|
| F411 | STM32 Cortex-M4 | 100MHz | Budget, AIO boards. Limited flash/peripherals. |
| F405 | STM32 Cortex-M4 | 168MHz | Mid-range workhorse. Good balance. |
| F722 | STM32 Cortex-M7 | 216MHz | Premium, faster processing. |
| F745 | STM32 Cortex-M7 | 216MHz | Premium with more flash. |
| F765 | STM32 Cortex-M7 | 216MHz | Premium, max flash/RAM. |
| H743 | STM32 Cortex-M7 | 480MHz | Top-tier, dual-core capable. Future-proof. |
| H753 | STM32 Cortex-M7 | 480MHz | H743 with crypto acceleration. |
| G473/G474 | STM32 Cortex-M4 | 170MHz | Newer, used by some AIO boards. |
| AT32 | Artery Cortex-M4 | 288MHz | Chinese alternative to STM32, growing adoption. |

**Trend**: The industry is moving from F4xx to H7xx for more processing headroom (cloud builds, GPS rescue, RPM filtering all demand more CPU).

#### IMU / Gyro Sensors
The gyro is the most critical sensor -- it tells the FC how the drone is oriented and rotating.
| Sensor | Type | Notes |
|---|---|---|
| MPU6000 | 6-axis (accel+gyro) | Classic, reliable, well-understood noise profile |
| ICM42688P | 6-axis | Newer, lower noise, higher sample rate. Current favorite. |
| BMI270 | 6-axis (Bosch) | Good alternative, used by many boards |
| BMI088 | 6-axis (Bosch) | Older Bosch IMU |
| LSM6DSO | 6-axis (ST) | ST Micro alternative |

#### Mounting Patterns
- **20x20mm**: Micro boards (2-4 inch builds), AIO boards
- **25.5x25.5mm**: Compact boards (some 3.5-5 inch builds)
- **30.5x30.5mm**: Full-size standard (5-7+ inch builds)
- Mounting holes: M2 screws for 20x20 and 25.5, M3 for 30.5
- Some frames support multiple patterns via slotted/multi-hole mounting plates

#### AIO (All-In-One) Boards
AIO boards integrate the FC with a 4-in-1 ESC on one PCB. Sometimes they also include VTX and/or RX.
- Common for sub-5-inch builds to save weight and simplify wiring
- Identified by "AIO" in name, or by having both FC and ESC specs (e.g., "F7 + 45A")
- AIO ESC current ratings are typically 5A-55A depending on build size

#### Autopilot FCs (Pixhawk/CubePilot/CUAV)
These are NOT standard FPV FCs. They run ArduPilot/PX4 firmware and are designed for autonomous drones, mapping, agriculture, etc. They use different mounting, different connectors, and different ecosystems. They show up in "flight controller" categories on retailers but are a different product class. Key identifiers: "Pixhawk", "Cube Orange", "Cube Purple", "CUAV", "PX4", "ArduPilot" in the name.

---

### 3.6 Stacks (FC + ESC Combos)

A stack is a pre-matched FC + ESC pair designed to be physically stacked together (FC on top, ESC on bottom, connected via header pins or cable). Benefits:
- Guaranteed mounting compatibility
- Often optimized wiring/connector design
- Price savings vs buying separately

A stack inherits attributes from BOTH the FC and ESC components: it has an MCU family, IMU, ESC current, ESC firmware, voltage range, and mounting pattern.

---

### 3.7 Batteries (LiPo)

**LiPo (Lithium Polymer)** batteries are the standard power source for FPV drones due to their high discharge rates and energy density.

#### Key Specs
- **Cell count (S)**: Number of cells in series. Determines voltage.
  - 1S = 3.7V nominal, 4.2V max
  - 4S = 14.8V nominal, 16.8V max
  - 6S = 22.2V nominal, 25.2V max
- **Capacity (mAh)**: Energy storage. Higher = longer flight time, but heavier.
  - 5-inch: 1100-1800mAh typical
  - 7-inch: 1300-2200mAh
- **C-rating**: Maximum safe discharge rate as a multiple of capacity.
  - 100C on a 1500mAh pack = 150A max discharge
  - Higher C-rating = can deliver more current = better throttle response
  - Marketing C-ratings are often inflated; 75C-150C is the marketed range
- **Connector**: The plug that connects to the ESC power lead
  - **XT60**: Standard for 5"+ builds
  - **XT30**: Smaller builds (3-4 inch)
  - **XT90**: Large builds (7-10 inch)
  - **BT2.0**: Tiny whoop standard
  - **PH2.0**: Older whoop connector
  - **GNB27**: Newer micro connector

#### Chemistry Types
| Chemistry | Nominal V/cell | Max V/cell | Use Case |
|---|---|---|---|
| LiPo | 3.7V | 4.2V | Standard, 95% of FPV batteries |
| LiHV | 3.85V | 4.35V | High-voltage variant, slightly more energy |
| Li-Ion | 3.6V | 4.2V | Long-range, lower discharge but higher density |
| LiFePO4 | 3.2V | 3.6V | Rare in FPV, very safe chemistry |

#### Naming Convention
`Brand Capacity CellCount C-Rating Connector`
Example: `GNB 1500mAh 6S 150C XT60`

Parallel packs: `6S2P` = 6 cells in series, 2 banks in parallel (double capacity)
Loose cells: `18650`, `21700`, `32700` designations = always 1S Li-Ion

---

### 3.8 FPV Video Systems

The video system is how the pilot sees. It consists of a camera + VTX (transmitter) on the drone, and goggles on the pilot. **All three must use the same video system -- they are mutually incompatible across systems.**

#### Current Systems (2024-2026)
| System | Type | Resolution | Latency | Market Position |
|---|---|---|---|---|
| **DJI O3** | Digital | 1080p | ~28ms | Market leader, best image quality |
| **DJI O4** | Digital | 1080p+ | ~22ms | Newest DJI, improved O3 |
| **HDZero** | Digital | 720p-1080p | ~4ms | Lowest latency, racing favorite |
| **Walksnail Avatar** | Digital | 1080p | ~22ms | DJI competitor, good value |
| **Analog** | Analog | 480p-720p | ~1ms | Legacy, cheapest, lightest |

#### FPV Cameras
- Micro size: 19mm x 19mm mounting (fits all standard frames)
- Full size: 28mm wide (older, less common)
- DJI cameras: 20mm mounting width (need compatible frame)
- Nano: ~14mm wide (tiny builds)

#### Video Transmitters (VTX)
- Power output: 25mW (short range, indoor) to 1600mW+ (long range)
- Mounting varies: 20x20, 25.5x25.5, 30.5x30.5, or standalone
- Analog VTX have adjustable channels/bands (5.8GHz)
- Digital VTX are system-locked (DJI O3 VTX only works with DJI O3 cameras + DJI goggles)

---

### 3.9 Receivers (RX)

Receives control commands from the pilot's radio transmitter.

#### Protocols
| Protocol | Band | Range | Notes |
|---|---|---|---|
| **ELRS (ExpressLRS)** | 2.4GHz / 900MHz | Good / Excellent | Open-source, fastest growing, low latency |
| **TBS Crossfire** | 900MHz | Excellent | Premium long-range, established |
| **TBS Tracer** | 2.4GHz | Good | TBS's 2.4GHz option |
| **FrSky ACCESS/ACCST** | 2.4GHz | Good | Established ecosystem, declining market share |
| **Flysky** | 2.4GHz | Moderate | Budget option |
| **DJI** | 2.4GHz | Good | Built into DJI radio controllers |
| **ImmersionRC Ghost** | 2.4GHz | Good | Niche, low latency |
| **RadioMaster Gemini** | 2.4GHz | Good | Dual-band ELRS variant |

**ELRS is the dominant trend**: Open source, community-driven, available in both 2.4GHz (shorter range, faster update) and 900MHz (longer range). Most new builds use ELRS.

#### Receiver Mounting
Small PCBs, typically attached with double-sided tape or zip ties. No standard bolt mounting. Some are built into AIO boards.

---

### 3.10 GPS Modules

Not required for basic FPV but increasingly popular for:
- GPS Rescue mode (auto-return if signal lost)
- Position hold (for filming)
- Speed/altitude OSD display
- iNav/ArduPilot waypoint navigation

#### Key Specs
- **GNSS chip**: u-blox M8N, M9N, M10 (newer = faster fix, more satellite systems)
- **Compass**: Many GPS modules include a magnetometer (compass) for heading
- **Protocol**: UART serial to FC (MSP, NMEA, UBX)

---

### 3.11 Antennas

#### VTX Antennas (video)
- **Connector types**: MMCX, U.FL/IPEX, SMA, RP-SMA
- **Polarization**: RHCP (Right-Hand Circular) or LHCP (Left-Hand Circular) -- must match between drone and goggles
- **Types**:
  - Omni (dipole/pagoda/lollipop): Good all-around coverage
  - Directional (patch/helical): Long range in one direction (typically on goggles)
  - Stubby: Short, durable, less range but crash-resistant

#### RX Antennas (control link)
- Typically T-type dipole or ceramic chip antenna
- 2.4GHz or 900MHz depending on protocol
- Mounting: zip-tied to frame arms, angled 90 degrees apart for diversity

---

## 4. Physical Compatibility Rules

### Hard Constraints (MUST match or parts won't physically fit)

| Check | Description | Fields |
|---|---|---|
| Frame <-> FC mount | FC bolt holes must align with frame's stack mounting holes | frame.fc_mounting_patterns_mm vs FC.mounting_pattern_mm |
| Frame <-> Motor mount bolt | Motor bolt size must match frame arm holes | frame.motor_mount_bolt_size vs motor.motor_mount_bolt_size |
| Frame <-> Motor mount spacing | Motor hole spacing must match | frame.motor_mount_hole_spacing_mm vs motor.motor_mount_hole_spacing_mm |
| Motor shaft <-> Prop hole | Prop center hole must fit motor shaft | motor.shaft_diameter_mm vs prop.mounting_hole_mm |
| ESC mount <-> Frame | ESC mounting must fit frame (if separate from FC) | ESC.mounting_pattern_mm must be in frame.fc_mounting_patterns_mm |

### Soft Constraints (will work physically but may have issues)

| Check | Description | Consequence |
|---|---|---|
| Prop size vs frame | Prop diameter should be within frame's supported range | Props may hit frame arms or other props |
| Battery voltage vs motor/ESC | Battery cell count should be in motor & ESC voltage range | Under-voltage = weak; over-voltage = burnt motor/ESC |
| Battery connector vs ESC | Battery plug type should match ESC input plug | Need adapter, adds weight/resistance |
| ESC current vs motor draw | ESC continuous current should exceed motor's max draw | ESC overheats, may burn out under sustained load |
| FC mounting hole size | FC mounting bolt size should match frame's FC bolt size | M2 bolt in M3 hole = loose; M3 in M2 = won't fit |

---

## 5. Connector & Interface Standards

### Battery Connectors
| Connector | Typical Use | Max Current | Notes |
|---|---|---|---|
| XT60 | 5"+ standard | ~60A continuous | Yellow, most common |
| XT30 | 3-4" builds | ~30A continuous | Smaller XT variant |
| XT90 | 7"+ heavy builds | ~90A continuous | Large, for high-power |
| BT2.0 | Tiny whoop | ~9A | BetaFPV standard |
| PH2.0 | Tiny whoop (legacy) | ~4.5A | JST PH connector |
| GNB27 | Micro 2-3" | ~27A | GNB's newer micro connector |

Normalize variants: XT60H = XT60, XT30U = XT30 (just housing variants)

### VTX/Antenna Connectors
- **MMCX**: Small, snap-on. Most common on modern VTX.
- **U.FL (IPEX)**: Tiny, fragile push-on. Common on AIO boards.
- **SMA / RP-SMA**: Threaded, robust. Used on standalone VTX and goggles. SMA and RP-SMA look similar but are NOT interchangeable (pin vs socket center conductor).

### FC/ESC Stack Connectors
- **Pin headers**: Solder-based connection between FC and 4-in-1 ESC in a stack
- **JST-SH (1mm pitch)**: Common for UART connections, GPS, RX plug-in
- **Solder pads**: Many FCs require soldering wires directly for VTX, RX, camera

---

## 6. Product Name Decoding Cheat Sheet

FPV product names encode a LOT of information in compact formats. Here are the patterns:

### Motors
```
"EMAX ECO II 2207 1900KV"
         ^^^^  Brand/Model
              ^^^^  2207 = stator (22mm dia, 07mm height)
                   ^^^^^^  1900 RPM per volt
```

### Propellers
```
"Gemfan Hurricane 51433"
                  ^^^^^  5.1" dia, 4.3" pitch, 3 blades

"HQProp 5x4.3x3"
        ^^^^^^^  5" dia, 4.3" pitch, 3 blades

"DAL Cyclone T5143"
                ^  T-mount hub
                 ^^^^  5.1" dia, 4.3" pitch, 3 blades
```

### Frames
```
"ImpulseRC Apex 5" HD"
                ^"     5-inch prop size
                   ^^  HD = DJI digital video compatible

"Diatone Roma F5 V2"
              ^^     F5 = 5-inch frame

"GEPRC Cinelog25 V2"
           ^^        25 / 10 = 2.5-inch
```

### Flight Controllers
```
"SpeedyBee F405 V4 30x30"
            ^^^^  F405 MCU family
                  ^^^^^  30.5x30.5mm mounting

"Happymodel CrazybeeX AIO - F4 FC + 12A BLHeli_S ESC"
                       ^^^  All-in-one (FC + ESC combined)
                             ^^  F4xx MCU family
                                  ^^^  12A ESC per motor
                                      ^^^^^^^^  ESC firmware
```

### Batteries
```
"CNHL 1500mAh 6S 100C LiPo XT60"
      ^^^^^^^  Capacity
            ^^  6 cells in series (22.2V nominal)
                ^^^^  100x discharge rate
                     ^^^^  Chemistry
                          ^^^^  Connector type
```

### ESCs
```
"T-Motor F55A Pro II 4-in-1 ESC 3-6S BLHeli_32 30x30"
         ^^^^  55A per motor continuous
               ^^^^^^  4 ESCs on one board
                       ^^^^  Supports 3S to 6S batteries
                            ^^^^^^^^^  Firmware
                                       ^^^^^  Mounting pattern
```

---

## 7. Common Misclassifications in Retailer Data

FPV retailers often categorize products loosely. Common issues:
- **GPS modules listed as flight controllers** (they're sold alongside FCs)
- **RTK positioning modules** listed as flight controllers
- **AIO boards** listed as either FCs or ESCs (they're both)
- **Stacks** sometimes listed under FCs, sometimes under ESCs
- **Power modules / PDBs** listed under flight controllers
- **Battery adapters/cables** listed under batteries
- **Frame replacement arms** listed under frames
- **BNF (Bind-and-Fly) complete drones** listed under their primary component category
- **Camera accessories** (mounts, ND filters) listed under cameras
- **Compass/baro modules** listed under flight controllers

---

## 8. Manufacturer Ecosystem Notes

### Major FC/ESC Brands
- **SpeedyBee**: Budget-friendly, good quality, popular F405/F722/H743 boards
- **BetaFPV**: Dominates tiny whoop and micro (1-3") market
- **Happymodel**: Budget micro builds, CrazybeeX AIOs
- **iFlight**: Mid-range, SucceX and BLITZ product lines
- **Diatone**: Mamba product line, good mid-range stacks
- **HGLRC**: Good value stacks and FCs
- **T-Motor**: Premium quality, higher price
- **Holybro**: ArduPilot/Pixhawk ecosystem (not standard FPV)
- **CubePilot**: Enterprise autopilot boards (not standard FPV)
- **Flywoo**: Budget to mid-range, GOKU line
- **GEPRC**: Integrated systems, growing rapidly
- **Matek/MATEKSYS**: Reliable, well-documented FCs popular with iNav community
- **FlightOne**: Premium FCs (Lightning H7)
- **FETtec**: Premium ESC ecosystem
- **Foxeer**: Cameras, VTX, and some FC/ESC products
- **RunCam**: Cameras and some VTX
- **TBS (Team BlackSheep)**: Crossfire/Tracer RX ecosystem, some FCs
- **RadioMaster**: Radio transmitters, ELRS ecosystem

### Motor Brands
- **EMAX**: ECO series (budget), RS series (mid), most popular brand
- **T-Motor**: Premium (F40, F60, Velox, Pacer series)
- **iFlight**: XING series
- **BrotherHobby**: VY, Avenger series
- **Axisflying**: Premium, C-series (C2207 etc.)
- **FlyFishRC**: Flash series
- **Flywoo**: NIN series

### Propeller Brands
- **Gemfan**: Market leader. Hurricane (aggressive), Windancer (smooth), Freestyle (balanced)
- **HQProp**: Premium. MacroQuad, Ethix (collab with JB)
- **DAL/Dalprop**: Budget, Cyclone and Fold series
- **Azure**: Racing props
- **Ethix**: Joshua Bardwell collaboration line (S3=5.1x3x3, S4=5.1x3.6x3, S5=5.1x3.1x3)

---

## 9. GetFPV Data Source Notes

GetFPV (getfpv.com) is a major US FPV retailer running Magento e-commerce.

### Product Page Structure
- **JSON-LD**: `<script type="application/ld+json">` with `@type: Product` -- contains name, price, image, brand, SKU
- **Spec table**: `#product-attribute-specs-table` with `<th>/<td>` key-value rows. Field names include:
  - "Mounting Pattern", "Flight Controller Processor", "Voltage", "Amps"
  - "ESC Firmware", "Gyro", "Flight Controller Firmware Targets"
  - "Number of ESC's", "Motor Size", "Motor KV", "Battery Connector"
- **Description**: `#description` with `<li>` items in `Key: Value` format

### Category URL Structure
- Magento `.html` suffix, `?p=N` pagination
- FPV flight controllers: `/electronics/flight-controllers.html`
- Stacks: `/electronics/stacks.html`
- Motors: `/motors/mini-quad-motors.html`
- And so on per category

### Anti-Bot Measures
- Returns HTTP 403 on automated requests
- Requires Playwright + playwright-stealth for browser emulation
- Respects rate limiting with 2-4s delays between pages

---

## Revision History
- **2026-03-07**: Initial comprehensive version, built from analysis of 3,113 GetFPV products + 862 RotorVillage products across 12 categories. FC section significantly expanded with MCU families, IMU sensors, AIO detection, and spec table extraction patterns.
