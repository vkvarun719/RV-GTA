import { ACADEMIC_BLOCK, LANDMARKS } from '../data/campus-layout';
import type { MissionDefinition } from '../types/game';

export const STORY_AND_SIDE_MISSIONS: MissionDefinition[] = [
  {
    id: 'story-1-attendance',
    title: 'Story 1: 8:58 AM Attendance Sprint',
    category: 'story',
    subtitle: '74.8% attendance! Reach Academic Block before 9:00 AM!',
    brief:
      'Spawn outside the RVITM gate, weave past morning walkers, dodge the patrolling ID-card check guard, and sprint to the 7-floor Academic Block porch before 9:00 AM!',
    rewardCash: 300,
    timeLimitSec: 45,
    startPos: { x: 66.5, z: -17.5 },
    spawnPlayerAt: { x: 73.5, z: -18.5, yaw: Math.PI * 0.5 },
    hasIdGuardHazard: true,
    checkpoints: [
      {
        id: 's1-gate',
        label: 'Slip past the ID-check guard into the Courtyard!',
        x: 34.0,
        z: -14.5,
        radius: 5.5,
        onFootOnly: true,
        dialogue: 'Guard: "Hey! Where is your ID card?!" — Run macha, run!',
      },
      {
        id: 's1-porch',
        label: 'Sprint up to the 7-Floor Academic Block Entrance Porch!',
        x: ACADEMIC_BLOCK.entranceTarget.x,
        z: ACADEMIC_BLOCK.entranceTarget.z,
        radius: 5.0,
        onFootOnly: true,
        dialogue: '8:59:45 AM! Attendance marked present! Barely survived!',
      },
    ],
  },
  {
    id: 'story-2-xerox',
    title: 'Story 2: Xerox & Record Hunt',
    category: 'story',
    subtitle: 'Viva in 2 minutes! Print & bind your lab record!',
    brief:
      'Hop on a scooter, zoom out the Main Gate to Benglooru Xerox & Records across 80 Feet Road, grab your lab record, park back in Student Parking, and reach the Porch!',
    rewardCash: 450,
    timeLimitSec: 80,
    startPos: { x: 23.0, z: -6.0 },
    spawnVehicle: { kind: 'scooter', x: 26.5, z: -11.0, yaw: 1.45 },
    checkpoints: [
      {
        id: 's2-xerox',
        label: 'Ride to Benglooru Xerox & Records opposite the gate',
        x: LANDMARKS.xeroxShop.x - 3.5,
        z: LANDMARKS.xeroxShop.z,
        radius: 5.5,
        dialogue: 'Uncle: "Record ready ide, ₹30 kodi! Rush back fast!"',
      },
      {
        id: 's2-parking',
        label: 'Park back inside the RVITM Student Parking Lot',
        x: LANDMARKS.parking.x,
        z: LANDMARKS.parking.z,
        radius: 6.0,
        dialogue: 'Scooter parked cleanly! Now dash to the Academic Block!',
      },
      {
        id: 's2-viva',
        label: 'Submit Lab Record at Academic Block Porch',
        x: ACADEMIC_BLOCK.entranceTarget.x,
        z: ACADEMIC_BLOCK.entranceTarget.z,
        radius: 5.0,
        dialogue: 'External Examiner: "Good spiral binding. Full viva marks!"',
      },
    ],
  },
  {
    id: 'story-3-canteen',
    title: 'Story 3: Canteen Rush',
    category: 'story',
    subtitle: '15-minute break! Deliver hot samosas & chai across campus!',
    brief:
      'Pick up piping hot samosas and cutting chai from RVITM Canteen and deliver them to the Basketball Court, Cricket Turf, and CSE Porch before break ends!',
    rewardCash: 500,
    timeLimitSec: 85,
    startPos: { x: LANDMARKS.canteen.x, z: LANDMARKS.canteen.z - 4.0 },
    checkpoints: [
      {
        id: 's3-bball',
        label: 'Deliver Samosa Box to the Basketball Court squad',
        x: LANDMARKS.basketballCourt.x,
        z: LANDMARKS.basketballCourt.z,
        radius: 6.0,
        dialogue: 'Hoops Squad: "Sakkath hot samosas! Next stop Cricket Turf!"',
      },
      {
        id: 's3-cricket',
        label: 'Deliver Masala Chai to the Cricket Practice Turf',
        x: LANDMARKS.cricketTurf.x,
        z: LANDMARKS.cricketTurf.z,
        radius: 6.5,
        dialogue: 'Bowler: "Last over before lecture! Thanks macha!"',
      },
      {
        id: 's3-cse',
        label: 'Deliver Filter Kaapi to Academic Block Porch',
        x: ACADEMIC_BLOCK.entranceTarget.x,
        z: ACADEMIC_BLOCK.entranceTarget.z,
        radius: 5.5,
        dialogue: 'Bell rang just in time! Canteen Legend status unlocked!',
      },
    ],
  },
  {
    id: 'side-meter-mele',
    title: 'Side Story: Meter Mele',
    category: 'side',
    subtitle: 'Wonandhalf? No! Honest meter auto pickups around JP Nagar!',
    brief:
      'Drive a yellow-green Auto-Rickshaw around Chaithanya Layout and Brookes Haven Main Road to pick up stranded students and drop them at the RVITM Main Gate!',
    rewardCash: 600,
    timeLimitSec: 105,
    startPos: { x: 70.0, z: -29.0 },
    spawnVehicle: { kind: 'auto', x: 67.5, z: -31.5, yaw: Math.PI - 0.12 },
    checkpoints: [
      {
        id: 'mm-brookes',
        label: 'Drive Auto to Brookes Haven Main Rd for Pickup #1',
        x: LANDMARKS.brookesHavenCorner.x,
        z: LANDMARKS.brookesHavenCorner.z,
        radius: 7.0,
        requiresVehicle: 'auto',
        dialogue: 'Student: "Anna RVITM gate! Meter mele haaki please!"',
      },
      {
        id: 'mm-chaithanya',
        label: 'Swing via Chaithanya Layout West for Pickup #2',
        x: LANDMARKS.chaithanyaWest.x,
        z: LANDMARKS.chaithanyaWest.z,
        radius: 7.5,
        requiresVehicle: 'auto',
        dialogue: 'Passenger: "Swalpa adjust maadi, 2nd seat share!"',
      },
      {
        id: 'mm-drop',
        label: 'Drop passengers at RVITM Main Gate',
        x: 61.5,
        z: -16.0,
        radius: 6.5,
        requiresVehicle: 'auto',
        dialogue: 'Passengers: "Exact meter fare + tip! Namma Auto rocks!"',
      },
    ],
  },
];

export interface GigTemplate {
  id: string;
  title: string;
  brief: string;
  rewardCash: number;
  timeLimitSec: number;
  pickup: { label: string; x: number; z: number; dialogue: string };
  dropoff: { label: string; x: number; z: number; dialogue: string };
  requiresVehicle?: 'auto';
}

export const GIG_TEMPLATES: GigTemplate[] = [
  {
    id: 'gig-chai-run',
    title: 'Goli Chai Express',
    brief: 'Fetch 4 cutting chais from Goli Tapri to the Basketball Court!',
    rewardCash: 180,
    timeLimitSec: 65,
    pickup: {
      label: 'Pick up Chai flask at Goli Chai Tapri',
      x: LANDMARKS.chaiStall.x - 3.5,
      z: LANDMARKS.chaiStall.z,
      dialogue: 'Tapri Anna: "Bisi bisi cutting chai packed!"',
    },
    dropoff: {
      label: 'Deliver Chai flask to Basketball Court',
      x: LANDMARKS.basketballCourt.x,
      z: LANDMARKS.basketballCourt.z,
      dialogue: 'Delivery complete! Cutting chai saves lives!',
    },
  },
  {
    id: 'gig-viva-print',
    title: 'Last-Minute Assignment Print',
    brief: 'Collect printouts from Benglooru Xerox and rush to Academic Block!',
    rewardCash: 200,
    timeLimitSec: 60,
    pickup: {
      label: 'Collect printouts at Benglooru Xerox',
      x: LANDMARKS.xeroxShop.x - 3.5,
      z: LANDMARKS.xeroxShop.z,
      dialogue: 'Printout done! Stapled and ready!',
    },
    dropoff: {
      label: 'Drop assignment at Academic Block Porch',
      x: ACADEMIC_BLOCK.entranceTarget.x,
      z: ACADEMIC_BLOCK.entranceTarget.z,
      dialogue: 'Submitted before the prof locked the door!',
    },
  },
  {
    id: 'gig-auto-bmtc',
    title: 'BMTC Stop Auto Shuttle',
    brief: 'Drive an Auto-Rickshaw from Sarathi/80ft BMTC stop to RVITM Gate.',
    rewardCash: 260,
    timeLimitSec: 70,
    requiresVehicle: 'auto',
    pickup: {
      label: 'Pick up commuter at BMTC 80ft Rd Stop (Auto required)',
      x: LANDMARKS.bmtcStop.x - 3.5,
      z: LANDMARKS.bmtcStop.z,
      dialogue: 'Commuter: "Straight to RVITM gate anna!"',
    },
    dropoff: {
      label: 'Drop commuter at RVITM Main Gate',
      x: 61.0,
      z: -16.5,
      dialogue: 'Clean meter ride! Cash received!',
    },
  },
  {
    id: 'gig-cafe-maggi',
    title: 'Filter Kaapi & Maggi Run',
    brief: 'Grab masala maggi from Filter Kaapi Cafe for the Cricket Turf crew!',
    rewardCash: 220,
    timeLimitSec: 70,
    pickup: {
      label: 'Pick up Maggi order at Filter Kaapi & Toast',
      x: LANDMARKS.cafeShop.x - 3.5,
      z: LANDMARKS.cafeShop.z,
      dialogue: 'Cafe Barista: "Extra cheese maggi ready!"',
    },
    dropoff: {
      label: 'Deliver to Cricket Practice Turf',
      x: LANDMARKS.cricketTurf.x,
      z: LANDMARKS.cricketTurf.z,
      dialogue: 'Cricket crew: "Best break snack ever!"',
    },
  },
];
