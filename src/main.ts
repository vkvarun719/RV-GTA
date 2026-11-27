import './style.css';
import * as THREE from 'three';
import { INTERACTABLES } from './data/campus-layout';
import { PhysicsWorld } from './systems/PhysicsWorld';
import { InputManager } from './systems/InputManager';
import { GraphicsManager } from './systems/GraphicsManager';
import { SaveManager } from './systems/SaveManager';
import { WeatherSystem } from './systems/WeatherSystem';
import { ClipRecorder } from './systems/ClipRecorder';
import { PhotoMode } from './systems/PhotoMode';
import { buildCampus } from './world/CampusBuilder';
import { WorldStreamer } from './world/WorldStreamer';
import { buildInstancedProps } from './world/InstancedProps';
import { FriendNpcManager } from './world/FriendNpcManager';
import { CollectiblesManager } from './world/CollectiblesManager';
import { PlayerController } from './player/PlayerController';
import { ChaseCamera } from './player/ChaseCamera';
import { AudioEngine } from './audio/AudioEngine';
import { VehicleManager } from './vehicles/VehicleController';
import { TrafficManager } from './vehicles/TrafficManager';
import { MissionManager } from './missions/MissionManager';
import { HudOverlay } from './ui/HudOverlay';
import { CheatTerminal } from './ui/CheatTerminal';
import { PhoneOverlay } from './ui/PhoneOverlay';
import { MapOverlay } from './ui/MapOverlay';
import { PauseMenu } from './ui/PauseMenu';
import type { MinimapBlip, VehicleKind } from './types/game';

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;

  const saveManager = new SaveManager();
  const physics = new PhysicsWorld();
  await physics.init();

  const graphics = new GraphicsManager(canvas, saveManager.data.graphicsQuality);
  const input = new InputManager(canvas);
  const audio = new AudioEngine();
  if (saveManager.data.radioEnabled) {
    audio.toggleRadio(true);
  }

  const campusVisuals = buildCampus(graphics.scene, physics);
  const propVisuals = buildInstancedProps(graphics.scene);
  const friendNpcs = new FriendNpcManager(graphics.scene);
  const collectibles = new CollectiblesManager(graphics.scene);
  const worldStreamer = new WorldStreamer(graphics.scene, physics, {
    loadRadiusM: 900,
    unloadRadiusM: 1300,
    onError: (msg) => {
      console.warn('[WorldStreamer]', msg);
      hud.showToast(msg);
    },
  });
  void worldStreamer.init(0, 0);

  // Expose debug handle for automated runtime verification
  (window as unknown as Record<string, unknown>).__nammaWorld = worldStreamer;

  const weather = new WeatherSystem(
    graphics,
    {
      roadMaterials: [],
      pavingMaterials: campusVisuals.pavingMaterials,
      nightLights: [
        ...campusVisuals.campusLights,
        propVisuals.streetLampMaterial,
      ],
    },
    saveManager.data.weatherOverride
  );

  const player = new PlayerController(graphics.scene, physics);
  player.onFootstep = () => audio.playFootstep();

  const vehicleManager = new VehicleManager(graphics.scene, physics);
  const trafficManager = new TrafficManager(graphics.scene, physics);
  const chaseCam = new ChaseCamera();
  const hud = new HudOverlay(uiRoot);
  const photoMode = new PhotoMode(uiRoot, canvas, chaseCam, graphics.camera, hud);
  const clipRecorder = new ClipRecorder(canvas);
  clipRecorder.onStatus = (msg) => hud.showToast(msg);

  const missionManager = new MissionManager(graphics.scene, saveManager.data.completedMissions, {
    onSubtitle: (msg) => hud.showSubtitle(msg),
    onToast: (msg) => hud.showToast(msg),
    onCashEarned: (amount) => {
      saveManager.data.cash += amount;
      saveManager.save();
    },
    onMissionComplete: (id, isGig) => {
      if (isGig) {
        saveManager.data.gigsCompleted += 1;
      } else if (!saveManager.data.completedMissions.includes(id)) {
        saveManager.data.completedMissions.push(id);
      }
      saveManager.save();
    },
    onSpawnVehicle: (kind, x, z, yaw) => {
      vehicleManager.spawnVehicle(kind, x, z, yaw);
    },
    onTeleportPlayer: (x, z, yaw) => {
      if (vehicleManager.activeVehicle) {
        vehicleManager.toggleEnterExit(player);
      }
      player.teleport(x, 0.3, z, yaw);
    },
    onChime: (ok) => audio.playChime(ok),
  });

  const syncUiLock = () => {
    const blocked =
      phoneOverlay.isOpen ||
      mapOverlay.isOpen ||
      cheatTerminal.isOpen ||
      pauseMenu.isOpen;
    input.uiBlocksGameplay = blocked;
    if (blocked) input.exitPointerLock();
  };

  const spawnInFrontOfPlayer = (kind: VehicleKind) => {
    const base = vehicleManager.getActivePosition() ?? player.getPosition();
    const fwdX = -Math.sin(chaseCam.yaw);
    const fwdZ = -Math.cos(chaseCam.yaw);
    const dist = kind === 'tanker' || kind === 'bus' ? 5.6 : 3.6;
    vehicleManager.spawnVehicle(
      kind,
      base.x + fwdX * dist,
      base.z + fwdZ * dist,
      chaseCam.yaw + Math.PI * 0.5
    );
  };

  const executeCheat = (raw: string): { ok: boolean; message: string } => {
    const code = raw.trim().toUpperCase();
    switch (code) {
      case 'AUTOWALA':
        spawnInFrontOfPlayer('auto');
        audio.playHorn('auto');
        hud.showToast('AUTOWALA! Auto-Rickshaw spawned!');
        return { ok: true, message: 'Spawned Bengaluru Yellow-Green Auto-Rickshaw!' };
      case 'BULLET':
        spawnInFrontOfPlayer('bike');
        audio.playHorn('bike');
        hud.showToast('BULLET! Commuter bike spawned!');
        return { ok: true, message: 'Spawned Sport Commuter Bike!' };
      case 'TANKER':
        spawnInFrontOfPlayer('tanker');
        audio.playHorn('tanker');
        hud.showToast('TANKER! Water Tanker inbound!');
        return { ok: true, message: 'Spawned Bengaluru Water Tanker!' };
      case 'MALEBANTHU':
        weather.setOverride('rain');
        saveManager.data.weatherOverride = 'rain';
        saveManager.save();
        hud.showToast('MALE BANTHU! Bengaluru rain + +25% gig bonus!');
        return { ok: true, message: 'Bengaluru rain activated + wet road reflections!' };
      case 'MACHA':
        player.superMachaMode = !player.superMachaMode;
        audio.playChime(true);
        hud.showToast(player.superMachaMode ? 'MACHA MODE ON: Super speed & jump!' : 'MACHA MODE OFF');
        return { ok: true, message: `Super sprint & high jump ${player.superMachaMode ? 'ENABLED' : 'DISABLED'}!` };
      case 'KASU':
        saveManager.data.cash += 10000;
        saveManager.save();
        audio.playChime(true);
        hud.showToast('KASU! +₹10,000 credited!');
        return { ok: true, message: 'Added ₹10,000 cash!' };
      case 'HELP':
        return { ok: true, message: 'AUTOWALA, BULLET, TANKER, MALEBANTHU, MACHA, KASU' };
      default:
        return { ok: false, message: 'Unknown code. Try AUTOWALA, BULLET, TANKER, MALEBANTHU, MACHA, KASU' };
    }
  };

  const cheatTerminal = new CheatTerminal(uiRoot, executeCheat);
  const mapOverlay = new MapOverlay(uiRoot);
  const phoneOverlay = new PhoneOverlay(uiRoot, missionManager.getGigCatalog(), {
    onAcceptGig: (tpl) => {
      missionManager.startPhoneGig(tpl, weather.state.isRaining);
    },
    onOpenFullMap: () => {
      mapOverlay.toggle(true);
      syncUiLock();
    },
    onToggleRadio: () => {
      const enabled = audio.toggleRadio();
      saveManager.data.radioEnabled = enabled;
      saveManager.save();
      hud.showToast(enabled ? 'Namma Radio: Lo-Fi ON' : 'Namma Radio OFF');
      return enabled;
    },
    onCheat: executeCheat,
    onOpenChange: () => syncUiLock(),
  });

  const pauseMenu = new PauseMenu(uiRoot, {
    onResume: () => syncUiLock(),
    onStartMission: (id) => {
      syncUiLock();
      missionManager.startMissionById(id, weather.state.isRaining);
    },
    onCancelMission: () => {
      missionManager.cancelActiveMission();
    },
    onGraphicsChange: (q, auto) => {
      graphics.autoQuality = auto;
      graphics.setQuality(q);
      saveManager.data.graphicsQuality = q;
      saveManager.save();
      hud.showToast(`Graphics: ${q.toUpperCase()}`);
    },
    onWeatherChange: (mode) => {
      weather.setOverride(mode);
      saveManager.data.weatherOverride = mode;
      saveManager.save();
      hud.showToast(`Weather: ${mode.toUpperCase()}`);
    },
    onExportSave: () => {
      saveManager.exportJson();
      hud.showToast('Exported save JSON!');
    },
    onImportSave: (txt) => {
      const ok = saveManager.importJson(txt);
      if (ok) {
        graphics.setQuality(saveManager.data.graphicsQuality);
        weather.setOverride(saveManager.data.weatherOverride);
        audio.toggleRadio(saveManager.data.radioEnabled);
        missionManager.completedIds.clear();
        for (const id of saveManager.data.completedMissions) {
          missionManager.completedIds.add(id);
        }
        pauseMenu.renderState(saveManager.data, graphics.autoQuality);
        hud.showToast('Save imported!');
      } else {
        hud.showToast('Invalid save JSON file');
      }
      return ok;
    },
    onResetSave: () => {
      saveManager.reset();
      missionManager.cancelActiveMission('Progress reset');
      missionManager.completedIds.clear();
      player.superMachaMode = false;
      audio.toggleRadio(false);
      graphics.setQuality(saveManager.data.graphicsQuality);
      weather.setOverride(saveManager.data.weatherOverride);
      pauseMenu.renderState(saveManager.data, graphics.autoQuality);
      hud.showToast('Progress reset to ₹500');
    },
  });

  cheatTerminal.onOpenChange = () => syncUiLock();
  mapOverlay.onOpenChange = () => syncUiLock();

  // Bind controls
  input.onAction('vehicleToggle', () => {
    if (photoMode.active) return;
    const res = vehicleManager.toggleEnterExit(player);
    if (res.entered) {
      hud.showToast(`Riding ${res.entered.model.spec.name}`);
      audio.playChime(true);
    } else if (res.exited) {
      hud.showToast('On foot');
    }
  });

  input.onAction('horn', () => {
    if (photoMode.active) return;
    if (vehicleManager.activeVehicle) {
      audio.playHorn(vehicleManager.activeVehicle.kind);
    }
  });

  input.onAction('interact', () => {
    if (photoMode.active) return;
    const pos = vehicleManager.getActivePosition() ?? player.getPosition();

    // 1. Check nearby Mission Start Beacon
    const startMission = missionManager.findNearbyStartMission(pos.x, pos.z);
    if (startMission) {
      missionManager.startMission(startMission, weather.state.isRaining);
      return;
    }

    // 2. Check nearby Friend NPCs
    const nearFriend = friendNpcs.findNearest(pos.x, pos.z);
    if (nearFriend) {
      const line = friendNpcs.interact(nearFriend);
      hud.showSubtitle(line);
      audio.playChime(true);
      return;
    }

    // 3. Check Chai / Canteen / Xerox shops
    for (const item of INTERACTABLES) {
      if (Math.hypot(pos.x - item.x, pos.z - item.z) <= item.radius) {
        const cost = item.type === 'chai' ? 20 : item.type === 'xerox' ? 30 : 35;
        if (saveManager.data.cash < cost) {
          hud.showToast('Not enough cash! Try a Phone Gig [P] or KASU!');
          audio.playChime(false);
          return;
        }
        saveManager.data.cash -= cost;
        if (item.type === 'chai') saveManager.data.chaiBought += 1;
        saveManager.save();
        audio.playChime(true);
        if (item.type === 'chai') {
          hud.showSubtitle('Tapri Anna: "Bisi cutting chai & maskabun! Sakkath energy macha!" (-₹20)');
        } else if (item.type === 'canteen') {
          hud.showSubtitle('Canteen Akka: "Crisp Masala Dosa & Samosa! Enjoy break!" (-₹35)');
        } else {
          hud.showSubtitle('Xerox Uncle: "Record printouts crisp & bound! All the best for viva!" (-₹30)');
        }
        return;
      }
    }
  });

  input.onAction('phone', () => {
    if (pauseMenu.isOpen || cheatTerminal.isOpen || photoMode.active) return;
    mapOverlay.toggle(false);
    phoneOverlay.toggle(weather.state, audio.radioEnabled);
    syncUiLock();
  });

  input.onAction('map', () => {
    if (pauseMenu.isOpen || cheatTerminal.isOpen || photoMode.active) return;
    phoneOverlay.toggle(weather.state, audio.radioEnabled, false);
    mapOverlay.toggle();
    syncUiLock();
  });

  input.onAction('terminal', () => {
    if (photoMode.active) return;
    pauseMenu.toggle(false);
    phoneOverlay.toggle(weather.state, audio.radioEnabled, false);
    mapOverlay.toggle(false);
    cheatTerminal.toggle();
    syncUiLock();
  });

  input.onAction('photo', () => {
    if (pauseMenu.isOpen || cheatTerminal.isOpen || phoneOverlay.isOpen || mapOverlay.isOpen) return;
    photoMode.toggle();
  });

  input.onAction('clip', () => {
    clipRecorder.saveLast15Seconds();
  });

  input.onAction('pause', () => {
    if (photoMode.active) {
      photoMode.toggle();
      return;
    }
    if (cheatTerminal.isOpen) {
      cheatTerminal.toggle(false);
      syncUiLock();
      return;
    }
    if (phoneOverlay.isOpen) {
      phoneOverlay.toggle(weather.state, audio.radioEnabled, false);
      syncUiLock();
      return;
    }
    if (mapOverlay.isOpen) {
      mapOverlay.toggle(false);
      syncUiLock();
      return;
    }
    pauseMenu.toggle(undefined, saveManager.data, graphics.autoQuality);
    syncUiLock();
  });

  hud.showSubtitle('Welcome to Namma RVITM! Press [E] at Gold/Purple beacons or [P] for Phone Gigs!');

  const clock = new THREE.Clock();

  function animate(): void {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    const paused = pauseMenu.isOpen;

    hud.setPointerLocked(input.isPointerLocked);

    if (!paused) {
      campusVisuals.flagMesh.rotation.y = Math.sin(elapsed * 3.5) * 0.14;

      if (!vehicleManager.activeVehicle && !photoMode.active) {
        const moved = player.update(dt, input, chaseCam.yaw);
        saveManager.data.totalDistanceM += moved;
      }

      const nightOrRain = weather.state.mode === 'night' || weather.state.isRaining;
      vehicleManager.update(dt, input, nightOrRain, weather.state.isRaining);
      physics.step(dt);

      const activePos = vehicleManager.getActivePosition() ?? player.getPosition();
      worldStreamer.update(activePos.x, activePos.z);
      friendNpcs.update(dt, activePos.x, activePos.z);
      const pickedBadge = collectibles.update(dt, activePos.x, activePos.z);
      if (pickedBadge) {
        const prog = collectibles.getProgress();
        saveManager.data.cash += 100;
        saveManager.save();
        audio.playChime(true);
        hud.showToast(`${pickedBadge.label} (${prog.collected}/${prog.total}) +₹100!`);
      }
      const story1Active = missionManager.activeMission?.definition.id === 'story-1-attendance';
      const caughtByGuard = trafficManager.update(dt, activePos, story1Active);

      const activeVeh = vehicleManager.activeVehicle;
      audio.updateEngine(activeVeh ? activeVeh.kind : null, activeVeh ? activeVeh.speedKmh : 0);
      audio.setRainIntensity(weather.state.isRaining);

      missionManager.update(
        dt,
        elapsed,
        activePos.x,
        activePos.z,
        activeVeh ? activeVeh.kind : null,
        caughtByGuard,
        weather.state.isRaining
      );

      weather.update(dt, activePos.x, activePos.z);

      // Context Interaction Prompt
      let prompt: string | null = null;
      const nearbyMission = missionManager.findNearbyStartMission(activePos.x, activePos.z);
      if (nearbyMission) {
        prompt = `[E] Start ${nearbyMission.title} (₹${nearbyMission.rewardCash})`;
      } else if (!activeVeh) {
        const nearVeh = vehicleManager.findNearest(activePos);
        if (nearVeh) {
          prompt = `[F] Ride ${nearVeh.model.spec.name}`;
        } else {
          const nearFriend = friendNpcs.findNearest(activePos.x, activePos.z);
          if (nearFriend) {
            prompt = `[E] Talk to ${nearFriend.name} (${nearFriend.branch})`;
          } else {
            for (const item of INTERACTABLES) {
              if (Math.hypot(activePos.x - item.x, activePos.z - item.z) <= item.radius) {
                prompt = `[E] ${item.label}`;
                break;
              }
            }
          }
        }
      }
      hud.setPrompt(prompt);

      chaseCam.update(
        dt,
        graphics.camera,
        input,
        physics,
        activePos,
        Boolean(activeVeh),
        activeVeh?.yaw
      );
      graphics.updateShadowFollow(activePos.x, activePos.z);
      graphics.trackFrame(dt);

      const blips: MinimapBlip[] = [
        ...missionManager.getBlips(),
        ...vehicleManager.vehicles.map((v) => {
          const t = v.body.translation();
          return { x: t.x, z: t.z, color: '#38bdf8', kind: 'vehicle' as const };
        }),
      ];

      hud.update(
        dt,
        activePos.x,
        activePos.z,
        chaseCam.yaw,
        saveManager.data.cash,
        graphics.currentFps,
        weather.state,
        audio.radioEnabled,
        missionManager.activeMission,
        vehicleManager.getActiveTelemetry(),
        blips
      );

      if (mapOverlay.isOpen) {
        mapOverlay.render(activePos.x, activePos.z, blips);
      }
    }

    graphics.render();
    input.clearFrame();
  }

  animate();
}

bootstrap();
