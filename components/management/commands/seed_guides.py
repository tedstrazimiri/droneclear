"""
seed_guides — Create a sample "5-inch Freestyle Quad" build guide for testing.
Usage:  python manage.py seed_guides
"""
from django.core.management.base import BaseCommand
from components.models import BuildGuide, BuildGuideStep


SAMPLE_GUIDE = {
    'pid': 'BG-5IN-FREE-01',
    'name': '5-inch Freestyle Quad Build',
    'description': (
        'Complete assembly guide for a 5-inch freestyle FPV quadcopter. '
        'Covers frame build-up through Betaflight configuration and final inspection.'
    ),
    'difficulty': 'intermediate',
    'estimated_time_minutes': 180,
    'drone_class': '5inch',
    'thumbnail': '',
    'required_tools': [
        'Soldering iron (60W+)',
        'Solder (60/40 or 63/37)',
        'Hex driver set (1.5, 2.0, 2.5 mm)',
        'Wire strippers / flush cutters',
        'Heat shrink tubing',
        'Zip ties',
        'Double-sided tape / mounting pads',
        'Loctite (blue / medium)',
        'Multimeter',
    ],
    'settings': {},
}

SAMPLE_STEPS = [
    {
        'order': 1,
        'title': 'Frame Assembly',
        'description': (
            'Unbox the frame kit and verify all hardware is present. '
            'Assemble the bottom plate, arms, and standoffs. '
            'Use Loctite on all bolts that will be exposed to vibration.'
        ),
        'step_type': 'assembly',
        'estimated_time_minutes': 20,
        'required_components': ['FRM-0001'],
    },
    {
        'order': 2,
        'title': 'Motor Mounting',
        'description': (
            'Mount all four motors to the arms using the supplied hardware. '
            'Pay attention to motor rotation direction — CW on rear-left and front-right, '
            'CCW on front-left and rear-right (props-in or props-out per your preference). '
            'Do not over-torque the screws; check motor bell spins freely.'
        ),
        'step_type': 'assembly',
        'estimated_time_minutes': 15,
        'required_components': ['MTR-0001'],
    },
    {
        'order': 3,
        'title': 'ESC Soldering',
        'description': (
            'Solder motor wires to the 4-in-1 ESC. Match the motor order (M1-M4) '
            'to the ESC pads. Tin all pads before soldering. '
            'Keep solder joints clean and avoid cold solder joints. '
            'Verify no shorts with a multimeter before powering on.'
        ),
        'safety_warning': (
            'Ensure the battery is disconnected during all soldering work. '
            'Use adequate ventilation — solder fumes are harmful.'
        ),
        'step_type': 'soldering',
        'estimated_time_minutes': 25,
        'required_components': ['ESC-0001'],
    },
    {
        'order': 4,
        'title': 'Flight Controller Stack',
        'description': (
            'Mount the ESC onto the frame standoffs, then place soft-mount grommets '
            'and install the flight controller on top. Connect the ESC ribbon cable '
            'or solder the signal wires. Verify the FC orientation arrow matches '
            'your intended forward direction.'
        ),
        'step_type': 'assembly',
        'estimated_time_minutes': 15,
        'required_components': ['FC-0001'],
    },
    {
        'order': 5,
        'title': 'Receiver Wiring',
        'description': (
            'Solder the receiver (RX) to the flight controller UART pads. '
            'Typical wiring: RX pad on FC → TX on receiver, TX pad on FC → RX on receiver. '
            'Power the receiver from a 5V pad. Secure the antenna with a zip tie '
            'away from the ESC and VTX.'
        ),
        'safety_warning': 'Double-check UART assignment in Betaflight before powering up.',
        'step_type': 'soldering',
        'estimated_time_minutes': 15,
        'required_components': ['RX-0001'],
    },
    {
        'order': 6,
        'title': 'VTX Installation',
        'description': (
            'Mount the video transmitter on the stack or to the frame with double-sided tape. '
            'Solder the VTX to the designated UART and power pads on the FC. '
            'Route the antenna pigtail to the rear of the frame. '
            'Never power on the VTX without an antenna attached.'
        ),
        'safety_warning': 'Never power VTX without antenna — it will burn out the output stage.',
        'step_type': 'soldering',
        'estimated_time_minutes': 15,
        'required_components': ['VTX-0001'],
    },
    {
        'order': 7,
        'title': 'Camera Mounting',
        'description': (
            'Install the FPV camera into the frame\'s camera mount. '
            'Solder camera power and video signal wires to the FC or VTX. '
            'Adjust tilt angle to ~25-35 degrees for freestyle. '
            'Secure excess wire with zip ties.'
        ),
        'step_type': 'assembly',
        'estimated_time_minutes': 10,
        'required_components': ['CAM-0001'],
    },
    {
        'order': 8,
        'title': '3D-Printed Accessories',
        'description': (
            'Print and install any 3D-printed parts such as antenna mounts, '
            'camera protectors, or GoPro mounts. Use TPU for parts that need flex '
            'and impact resistance. PETG or ABS for rigid mounts.'
        ),
        'step_type': '3d_print',
        'estimated_time_minutes': 10,
    },
    {
        'order': 9,
        'title': 'Betaflight Flash & Tune',
        'description': (
            'Connect the FC via USB. Flash the latest Betaflight firmware. '
            'Apply the CLI dump below as a starting tune, then verify:\n'
            '- Motor order and direction in Motors tab\n'
            '- Receiver channels in Receiver tab\n'
            '- VTX table and power settings\n'
            '- Modes (Arm, Angle, Beeper, etc.)\n'
            '- OSD layout'
        ),
        'betaflight_cli': (
            '# Betaflight 4.4+ starting tune for 5" freestyle\n'
            'set motor_pwm_protocol = DSHOT600\n'
            'set dshot_bidir = ON\n'
            'set pid_process_denom = 2\n'
            'set simplified_master_multiplier = 120\n'
            'set simplified_i_gain = 80\n'
            'set simplified_d_gain = 100\n'
            'set simplified_dmax_gain = 0\n'
            'set simplified_feedforward_gain = 100\n'
            'set simplified_pitch_d_gain = 105\n'
            'set simplified_pitch_pi_gain = 105\n'
            'profile 0\n'
            'simplified_tuning apply\n'
            'set iterm_relax_cutoff = 15\n'
            'save\n'
        ),
        'step_type': 'firmware',
        'estimated_time_minutes': 30,
    },
    {
        'order': 10,
        'title': 'Final Inspection',
        'description': (
            'Perform a full pre-flight check:\n'
            '1. Wiggle test — tug all solder joints and connectors\n'
            '2. Prop-off motor spin test — verify correct direction and smooth operation\n'
            '3. Failsafe test — confirm RX failsafe triggers disarm\n'
            '4. Range check — walk 30m away, verify no signal loss\n'
            '5. Visual inspection — no loose screws, no exposed wires, antenna secure\n'
            '6. Balance check — CG should be near the centre of the frame\n\n'
            'Mount propellers only after all electronic checks pass.'
        ),
        'safety_warning': (
            'Do NOT install propellers until all electronic checks are complete. '
            'Spinning props can cause serious injury.'
        ),
        'step_type': 'inspection',
        'estimated_time_minutes': 15,
        'required_components': ['PRP-0001'],
    },
]


class Command(BaseCommand):
    help = 'Seed a sample 5-inch freestyle build guide for testing.'

    def handle(self, *args, **options):
        guide, created = BuildGuide.objects.update_or_create(
            pid=SAMPLE_GUIDE['pid'],
            defaults={k: v for k, v in SAMPLE_GUIDE.items() if k != 'pid'},
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(f'{action} guide: {guide.name} ({guide.pid})')

        # Remove old steps and recreate
        guide.steps.all().delete()
        for step_data in SAMPLE_STEPS:
            BuildGuideStep.objects.create(guide=guide, **step_data)
        self.stdout.write(self.style.SUCCESS(
            f'  -> {len(SAMPLE_STEPS)} steps seeded successfully.'
        ))
