Flashing a custom kernel is a multi-phase process: preparing the device, unlocking it, getting a custom recovery in place, backing up, and then flashing your kernel. Here's the full pipeline.
Phase 0 — Prerequisites
Before touching anything:

Platform-tools (adb + fastboot) installed and on your PATH. Get them from developer.android.com/tools/releases/platform-tools.
USB drivers for your device (critical on Windows; Linux and macOS usually just work).
Battery above 60%.
Your kernel artifact — either a flashable boot.img, or (much preferred) an AnyKernel3 zip, which patches the existing boot image rather than replacing it wholesale.
Device-specific knowledge: know your exact model/variant, partition scheme (A-only vs A/B), and whether it uses dynamic partitions. Mixing up variants is the #1 cause of bricks.
A way back: download the stock firmware package for your exact model before you start. For Xiaomi that's a fastboot ROM + MiFlash, for Samsung it's Odin + an official firmware, for Pixel it's the factory image.

Assume every step is destructive until proven otherwise. Unlocking alone wipes userdata.
Phase 1 — Enable developer access

Settings → About Phone → tap Build Number seven times.
Settings → System → Developer Options → enable USB Debugging and OEM Unlocking.
Plug in, accept the RSA fingerprint prompt on the device, then confirm:

   adb devices
You should see your device listed as device, not unauthorized.
Phase 2 — Unlock the bootloader
This is vendor-specific:

Pixel / generic:

  adb reboot bootloader
  fastboot flashing unlock
Confirm on the device with volume/power keys.

Xiaomi: requires their Mi Unlock tool and a 7-day (sometimes longer) waiting period tied to your Mi account.
Samsung: no fastboot unlock — you toggle OEM unlock, then Odin-flash in download mode.
OnePlus / Nothing / Sony: usually fastboot oem unlock or a token-based unlock from their developer portal.

This wipes the device. Set it up again afterward (or skip setup — you don't need Google sign-in for the rest).
Verify:
fastboot getvar unlocked
Should return unlocked: yes.
Phase 3 — Install a custom recovery (optional but recommended)
TWRP or OrangeFox give you a sandbox for backups, flashing zips, and recovery if things go wrong. Grab the image for your exact device codename.
For A/B devices:
fastboot boot twrp.img          # temporary boot into TWRP
Then from inside TWRP, install the TWRP installer zip to make it persistent (varies by device; some need to flash to both boot_a and boot_b).
For A-only devices:
fastboot flash recovery twrp.img
fastboot reboot recovery
If your kernel ships as an AnyKernel3 zip, you need recovery. If it's a raw boot.img, you technically don't — you can flash it directly via fastboot.
Phase 4 — Back up the stock boot image
Do not skip this. Before flashing anything, pull the current boot image so you can restore it:
adb shell
su                              # if rooted; otherwise extract from stock firmware
dd if=/dev/block/by-name/boot of=/sdcard/stock_boot.img
exit
adb pull /sdcard/stock_boot.img
If not rooted, extract boot.img from the stock firmware package you downloaded in Phase 0 and keep it somewhere safe. Also do a full TWRP backup of Boot, System, and Vendor if you have the space.
Phase 5 — Flash the kernel
Method A — AnyKernel3 zip (preferred for custom kernels):
adb push kernel.zip /sdcard/
adb reboot recovery
In TWRP: Install → select the zip → swipe to flash → reboot system.
AnyKernel3 is a framework that unpacks the current boot image, swaps in your new Image.gz/dtb/dtbo plus any modifications, and repacks it. It's resilient across minor stock updates, which is why kernel devs ship with it.
Method B — Raw boot.img via fastboot:
adb reboot bootloader
fastboot flash boot kernel_boot.img
fastboot reboot
On A/B devices, flash to the current slot, or both slots to be safe:
fastboot flash boot_a kernel_boot.img
fastboot flash boot_b kernel_boot.img
Method C — fastboot boot for testing:
fastboot boot kernel_boot.img
This boots the kernel without writing it. If the device doesn't boot or misbehaves, just power-cycle and you're back to stock. Extremely useful for testing a kernel you just built before committing it.
Phase 6 — Verify
Once booted:
adb shell uname -a
adb shell cat /proc/version
Confirm the kernel string, build date, and compiler match what you expect. Check dmesg for any obvious driver failures, and sanity-check Wi-Fi, cellular, camera, and fingerprint — these are the usual casualties of custom kernels because they depend on vendor blobs and kernel ABI.
If you built the kernel yourself
The "novel kernel" part implies you're compiling from source. The short version:

Clone your kernel source (typically a fork of your device's stock kernel tree).
Set up a cross-compile toolchain — most modern ARM64 Android kernels use Clang/LLVM from AOSP's prebuilts (prebuilts/clang/host/linux-x86/clang-r...), not GCC.
Build:

   export ARCH=arm64
   export LLVM=1
   make O=out <device>_defconfig
   make O=out -j$(nproc)

Your artifacts appear in out/arch/arm64/boot/ — typically Image.gz-dtb or Image.gz + a dtb/dtbo.img.
Drop those into an AnyKernel3 template (anykernel.sh configures device checks and partition paths), zip it, and flash via Phase 5 Method A.

For a first flash of a freshly built kernel, I'd strongly recommend fastboot boot on a repacked boot image first — much lower blast radius than committing it.
Recovery if you brick

Bootloop: hold vol-down + power to get back to fastboot, then fastboot flash boot stock_boot.img.
Soft-bricked (stuck at logo): same as above, or boot TWRP and restore the backup.
Hard brick (no fastboot): EDL mode on Qualcomm devices (requires a test-point short on some phones and the EDL programmer file for your device), Odin on Samsung, MiFlash on Xiaomi. This is why you downloaded the stock firmware in Phase 0.

One thing worth flagging given the "novel kernel" framing: if this is for a mainline or from-scratch kernel rather than a fork of the vendor tree, expect to spend most of your time on DTB/DTS work and dealing with closed-source vendor HALs that assume specific kernel symbols. That's usually the hard part, not the flashing.