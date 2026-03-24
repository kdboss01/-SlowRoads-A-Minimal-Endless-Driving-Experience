import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Mountain, Volume2 } from 'lucide-react';

const SlowRoads = () => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const engineOscRef = useRef(null);
  const engineGainRef = useRef(null);
  const windNoiseRef = useRef(null);
  const windGainRef = useRef(null);
  
  const [settings, setSettings] = useState({
    timeOfDay: 'day',
    terrain: 'hills',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const gameRef = useRef({
    player: {
      x: 0,
      z: 0,
      speed: 0,
      maxSpeed: 180,        // Top potential speed
      maxReverseSpeed: -100,
      acceleration: 0.8,    // More realistic base acceleration
      deceleration: 0.5,
      friction: 0.996,      // Realistic air resistance
      turnSpeed: 0,
      turnAngle: 0,
      gear: 'neutral',
      crashed: false,
      boost: 100,           // Boost meter (0-100)
      boosting: false
    },
    camera: {
      x: 0,
      y: 200,
      z: 0,
      fieldOfView: 120,
      baseFOV: 120
    },
    roadSegments: [],
    segmentLength: 200,
    roadWidth: 2000,
    position: 0,
    score: 0,
    overtakes: 0,
    curve: 0,
    trees: [],
    clouds: [],
    obstacles: [],
    keys: {},
    time: 0,
    dayTime: 0,
    frame: 0,
    shake: 0
  });

  // Initialize audio with user interaction
  const initAudio = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 60;
      
      const osc2 = audioCtx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 120;
      
      const gain1 = audioCtx.createGain();
      gain1.gain.value = 0.04;
      
      const gain2 = audioCtx.createGain();
      gain2.gain.value = 0.02;
      
      const engineFilter = audioCtx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineFilter.Q.value = 1;
      
      const engineGain = audioCtx.createGain();
      engineGain.gain.value = 0.08;
      
      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(engineFilter);
      gain2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      
      engineOscRef.current = { osc1, osc2, filter: engineFilter };
      engineGainRef.current = engineGain;

      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      
      let prevValue = 0;
      for (let i = 0; i < bufferSize; i++) {
        const newValue = Math.random() * 2 - 1;
        output[i] = (prevValue + newValue) / 2;
        prevValue = newValue;
      }
      
      const windNoise = audioCtx.createBufferSource();
      windNoise.buffer = noiseBuffer;
      windNoise.loop = true;
      
      const windFilter1 = audioCtx.createBiquadFilter();
      windFilter1.type = 'highpass';
      windFilter1.frequency.value = 200;
      
      const windFilter2 = audioCtx.createBiquadFilter();
      windFilter2.type = 'lowpass';
      windFilter2.frequency.value = 600;
      
      const windGain = audioCtx.createGain();
      windGain.gain.value = 0;
      
      windNoise.connect(windFilter1);
      windFilter1.connect(windFilter2);
      windFilter2.connect(windGain);
      windGain.connect(audioCtx.destination);
      windNoise.start();
      
      windNoiseRef.current = windNoise;
      windGainRef.current = windGain;

      setAudioEnabled(true);
    } catch (error) {
      console.error('Audio init failed:', error);
    }
  };

  const updateAudio = useCallback(() => {
    if (!audioContextRef.current || !engineOscRef.current) return;
    
    const game = gameRef.current;
    const player = game.player;
    const speedPercent = Math.abs(player.speed) / player.maxSpeed;
    
    const baseFreq1 = player.gear === 'reverse' ? 50 : 60;
    const baseFreq2 = player.gear === 'reverse' ? 100 : 120;
    const targetFreq1 = baseFreq1 + (speedPercent * 180);
    const targetFreq2 = baseFreq2 + (speedPercent * 180);
    
    const currentTime = audioContextRef.current.currentTime;
    engineOscRef.current.osc1.frequency.exponentialRampToValueAtTime(
      Math.max(20, targetFreq1),
      currentTime + 0.1
    );
    engineOscRef.current.osc2.frequency.exponentialRampToValueAtTime(
      Math.max(20, targetFreq2),
      currentTime + 0.1
    );
    
    const engineVol = 0.04 + (speedPercent * 0.06);
    engineGainRef.current.gain.linearRampToValueAtTime(
      engineVol,
      currentTime + 0.1
    );
    
    if (windGainRef.current) {
      const windVol = speedPercent * 0.04;
      windGainRef.current.gain.linearRampToValueAtTime(
        windVol,
        currentTime + 0.1
      );
    }
  }, []);

  const generateSegment = useCallback((i) => {
    const game = gameRef.current;
    const z = i * game.segmentLength;
    const curve = Math.sin(i * 0.015) * 600 + Math.sin(i * 0.04) * 300;
    
    let hill = 0;
    if (settings.terrain === 'hills') {
      hill = Math.sin(i * 0.03) * 1500;
    } else if (settings.terrain === 'mountains') {
      hill = Math.sin(i * 0.02) * 3000 + Math.sin(i * 0.05) * 1000;
    }
    
    return {
      z: z,
      curve: curve,
      hill: hill,
      y: hill,
      index: i
    };
  }, [settings.terrain]);

  const spawnObstacle = useCallback((z) => {
    const lanes = [-1500, -500, 500, 1500];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    // Capped at 140 km/h (93.33 internal units)
    const speed = 40 + Math.random() * 53.33; 
    const color = ['#ff0000', '#0000ff', '#ffff00', '#00ff00', '#ffffff', '#a855f7', '#ec4899'][Math.floor(Math.random() * 7)];
    
    return {
      x: lane,
      z: z,
      speed: speed,
      color: color,
      width: 600,
      height: 350,
      length: 800
    };
  }, []);

  const initializeRoad = useCallback(() => {
    const game = gameRef.current;
    game.roadSegments = [];
    
    for (let i = 0; i < 600; i++) {
      game.roadSegments.push(generateSegment(i));
    }
    
    game.trees = [];
    for (let i = 0; i < 200; i++) {
      // Ensure trees are well outside the road width (2000)
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (2500 + Math.random() * 8000); // 2500 to 10500
      
      game.trees.push({
        x: x,
        z: Math.random() * 100000,
        height: 600 + Math.random() * 600,
        width: 150 + Math.random() * 150
      });
    }
    
    game.clouds = [];
    for (let i = 0; i < 40; i++) {
      game.clouds.push({
        x: (Math.random() - 0.5) * 30000,
        y: 3000 + Math.random() * 3000,
        z: Math.random() * 100000,
        size: 500 + Math.random() * 800,
        speed: 0.1 + Math.random() * 0.3
      });
    }

    // Reset obstacles
    game.obstacles = [];
  }, [generateSegment]);

  useEffect(() => {
    initializeRoad();
  }, [initializeRoad]);

  const getColors = useCallback(() => {
    const colors = {
      day: {
        sky: ['#87CEEB', '#E0F6FF'],
        horizon: '#FFE4B5',
        grass: '#5ab552',
        road: '#6b6b6b',
        roadLine: '#ffffff',
        tree: '#228B22',
        trunk: '#5D4037'
      },
      sunset: {
        sky: ['#FF6B35', '#F7931E'],
        horizon: '#FFB347',
        grass: '#5a8f52',
        road: '#5a5a5a',
        roadLine: '#ffa500',
        tree: '#2F4F2F',
        trunk: '#3E2723'
      },
      night: {
        sky: ['#0B1929', '#1a2332'],
        horizon: '#2C3E50',
        grass: '#1a3a1a',
        road: '#3a3a3a',
        roadLine: '#ffffff',
        tree: '#0D3D0D',
        trunk: '#212121'
      }
    };
    return colors[settings.timeOfDay];
  }, [settings.timeOfDay]);

  const updateGame = useCallback(() => {
    const game = gameRef.current;
    const player = game.player;
    
    game.frame++;
    game.time += 0.01;
    game.dayTime += 1 / 60; // Approximate seconds (assuming 60fps)

    // Dynamic Time of Day Cycle
    let newTimeOfDay = settings.timeOfDay;
    const cycleTime = game.dayTime % 240; // 240 second total cycle
    
    if (cycleTime < 80) newTimeOfDay = 'day';
    else if (cycleTime < 120) newTimeOfDay = 'sunset';
    else if (cycleTime < 200) newTimeOfDay = 'night';
    else newTimeOfDay = 'sunset'; // Sunrise

    if (newTimeOfDay !== settings.timeOfDay) {
      setSettings(prev => ({ ...prev, timeOfDay: newTimeOfDay }));
    }

    // Dynamic FOV based on speed
    const speedRatio = Math.abs(player.speed) / player.maxSpeed;
    const targetFOV = game.camera.baseFOV + (speedRatio * 40); 
    game.camera.fieldOfView += (targetFOV - game.camera.fieldOfView) * 0.1;

    // Screen Shake Logic
    game.shake = 0;
    if (player.crashed) {
      game.shake = 20; 
    } else if (player.speed > 100) { 
      game.shake = Math.max(0, (player.speed - 100) / 10); 
    }
    
    // Boost Logic
    let isBoosting = false;
    if ((game.keys['Shift'] || game.keys['ShiftLeft'] || game.keys['ShiftRight']) && player.boost > 0 && player.speed > 0) {
      isBoosting = true;
      player.boost = Math.max(0, player.boost - 0.5); // Consume boost
      game.shake = Math.max(game.shake, 2); // Slight shake when boosting
    } else {
      player.boost = Math.min(100, player.boost + 0.1); // Regenerate boost
    }
    player.boosting = isBoosting;

    const currentMaxSpeed = isBoosting ? player.maxSpeed * 1.5 : player.maxSpeed;
    const currentAcceleration = isBoosting ? player.acceleration * 2 : player.acceleration;

    if (player.crashed) {
      player.speed *= 0.95; // Rapid deceleration
      if (player.speed < 1) {
        player.speed = 0;
      }
    } else {
      if (game.keys['ArrowUp'] || game.keys['w']) {
        player.gear = 'forward';
        
        // Realistic acceleration curve: Faster at low speeds, slower at high speeds
        const speedPercent = Math.abs(player.speed) / currentMaxSpeed;
        const accelFactor = Math.max(0.2, 1 - speedPercent * 0.8); // 100% at 0km/h, 20% near max speed
        player.speed += currentAcceleration * accelFactor;
        
      } else if (game.keys['ArrowDown'] || game.keys['s']) {
        player.gear = 'reverse';
        player.speed -= player.acceleration;
      } else {
        player.gear = 'neutral';
        if (player.speed > 0) {
          player.speed = Math.max(player.speed - player.deceleration * 0.5, 0);
        } else if (player.speed < 0) {
          player.speed = Math.min(player.speed + player.deceleration * 0.5, 0);
        }
      }
    }
    
    // Apply air resistance
    player.speed *= player.friction;
    
    // Cap speeds
    if (player.speed > currentMaxSpeed) player.speed = currentMaxSpeed;
    if (player.speed < player.maxReverseSpeed) player.speed = player.maxReverseSpeed;
    
    let turnInput = 0;
    if (game.keys['ArrowLeft'] || game.keys['a']) turnInput = -1;
    if (game.keys['ArrowRight'] || game.keys['d']) turnInput = 1;
    
    const speedFactor = Math.abs(player.speed) / player.maxSpeed; // Use base max speed for steering feel
    const steerStrength = 6 + (speedFactor * 4); // Increased steering responsiveness
    
    if (player.speed < 0) turnInput *= -1;
    
    player.turnSpeed += turnInput * steerStrength;
    player.turnSpeed *= 0.9;
    
    player.x += player.turnSpeed;
    player.x = Math.max(-game.roadWidth, Math.min(game.roadWidth, player.x));
    
    const oldPosition = game.position;
    game.position += player.speed;
    
    // Score Calculation
    if (player.speed > 0) {
      game.score += (player.speed * 0.01);
    }

    if (game.position < 0) {
      game.position = 0;
      player.speed = 0;
    }

    // Spawn obstacles (High density, starting 2000 units ahead)
    if (game.obstacles.length < 20 && Math.random() < 0.1) {
      const spawnZ = game.position + 2000 + Math.random() * 1500;
      game.obstacles.push(spawnObstacle(spawnZ));
    }

    // Update obstacles
    game.obstacles.forEach((obs, index) => {
      const wasBehind = obs.z < oldPosition;
      obs.z += obs.speed;
      const isBehind = obs.z < game.position;
      
      // Overtake logic
      if (!wasBehind && isBehind && Math.abs(obs.x - player.x) > 400) {
         game.overtakes++;
         game.score += 100; // Bonus for overtaking
      }

      if (!player.crashed &&
          obs.z > game.position && obs.z < game.position + 500 &&
          Math.abs(obs.x - player.x) < (obs.width + 400) / 2) {
        player.crashed = true;
        player.speed = -player.speed * 0.5;
        game.shake = 20;
      }
    });

    // Remove obstacles as soon as they are passed
    game.obstacles = game.obstacles.filter(obs => obs.z > game.position);

    if (player.crashed && player.speed === 0 && (game.keys['ArrowUp'] || game.keys['w'])) {
      player.crashed = false;
      player.x = 0;
    }

    // Proactive road generation
    const currentSegmentIndex = Math.floor(game.position / game.segmentLength);
    if (game.roadSegments.length < currentSegmentIndex + 500) {
      for (let j = 0; j < 100; j++) {
        game.roadSegments.push(generateSegment(game.roadSegments.length));
      }
    }
    
    // Recycling
    game.trees.forEach(tree => {
      if (tree.z < game.position - 2000) {
        tree.z += 100000;
        // Keep trees off-road when recycling
        const side = Math.random() > 0.5 ? 1 : -1;
        tree.x = side * (2500 + Math.random() * 8000);
      }
    });

    game.clouds.forEach(cloud => {
      cloud.x += cloud.speed * 10;
      if (cloud.z < game.position - 10000) {
        cloud.z += 100000;
      }
      if (cloud.x > 15000) cloud.x = -15000;
    });
    
    const baseSegment = Math.floor(game.position / game.segmentLength);
    if (baseSegment >= 0 && baseSegment < game.roadSegments.length - 1) {
      const segment = game.roadSegments[baseSegment];
      game.camera.x = player.x - segment.curve;
      game.camera.y = segment.y + 200;
      game.curve = segment.curve;
    }
    
    updateAudio();
  }, [settings.timeOfDay, generateSegment, spawnObstacle, updateAudio]);

  const project3D = useCallback((x, y, z, cameraX, cameraY, cameraZ) => {
    const game = gameRef.current;
    const distance = z - cameraZ;
    
    if (distance <= 0) return { x: 400 + (x - cameraX) * 10000, y: 600, scale: 0 };
    
    const scale = game.camera.fieldOfView / distance;
    
    return {
      x: 400 + (x - cameraX) * scale,
      y: 300 + (cameraY - y) * scale,
      scale: scale
    };
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    const colors = getColors();
    const player = game.player;
    
    ctx.save();
    if (game.shake > 0) {
      const shakeX = (Math.random() - 0.5) * game.shake;
      const shakeY = (Math.random() - 0.5) * game.shake;
      ctx.translate(shakeX, shakeY);
    }
    
    const skyGradient = ctx.createLinearGradient(0, 0, 0, 400);
    skyGradient.addColorStop(0, colors.sky[0]);
    skyGradient.addColorStop(1, colors.sky[1]);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, 800, 600);
    
    // Clouds
    game.clouds.forEach(cloud => {
      const p = project3D(cloud.x, cloud.y, cloud.z, game.camera.x, game.camera.y, game.position);
      if (p.scale > 0 && p.y < 350) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, cloud.size * p.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (settings.timeOfDay === 'day') {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(700, 100, 40, 0, Math.PI * 2);
      ctx.fill();
    } else if (settings.timeOfDay === 'night') {
      ctx.fillStyle = '#F0E68C';
      ctx.beginPath();
      ctx.arc(150, 120, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 50; i++) {
        ctx.fillRect((i * 97) % 800, (i * 127) % 250, 2, 2);
      }
    }
    
    ctx.fillStyle = colors.horizon;
    ctx.fillRect(0, 300, 800, 50);
    
    const startSegmentIndex = Math.floor(game.position / game.segmentLength);
    
    // RENDER LOOP (Road + Objects to ensure correct depth)
    for (let i = 200; i >= -1; i--) {
      const segmentIndex = startSegmentIndex + i;
      const segment = game.roadSegments[segmentIndex];
      if (!segment) continue;
      
      const nextSegment = game.roadSegments[segmentIndex + 1];
      if (!nextSegment) continue;
      
      const p1 = project3D(-game.roadWidth + segment.curve, segment.y, segment.z, game.camera.x, game.camera.y, game.position);
      const p2 = project3D(game.roadWidth + segment.curve, segment.y, segment.z, game.camera.x, game.camera.y, game.position);
      const p3 = project3D(-game.roadWidth + nextSegment.curve, nextSegment.y, nextSegment.z, game.camera.x, game.camera.y, game.position);
      const p4 = project3D(game.roadWidth + nextSegment.curve, nextSegment.y, nextSegment.z, game.camera.x, game.camera.y, game.position);
      
      // Grass
      ctx.fillStyle = segmentIndex % 2 === 0 ? colors.grass : colors.grass + 'dd';
      ctx.beginPath();
      ctx.moveTo(0, p1.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(0, p3.y);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(800, p2.y);
      ctx.lineTo(800, p4.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fill();
      
      // Road
      ctx.fillStyle = segmentIndex % 2 === 0 ? colors.road : colors.road + 'ee';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
      
      // Road Lines
      if (segmentIndex % 3 === 0) {
        const lineWidth = 15 * p1.scale;
        ctx.fillStyle = colors.roadLine;
        const centerX = (p1.x + p2.x) / 2;
        const nextCenterX = (p3.x + p4.x) / 2;
        ctx.beginPath();
        ctx.moveTo(centerX - lineWidth / 2, p1.y);
        ctx.lineTo(centerX + lineWidth / 2, p1.y);
        ctx.lineTo(nextCenterX + (15 * p3.scale) / 2, p3.y);
        ctx.lineTo(nextCenterX - (15 * p3.scale) / 2, p3.y);
        ctx.closePath();
        ctx.fill();
      }

      // RENDER OBJECTS FOR THIS SEGMENT
      
      // Render Obstacles (Cars) in this segment
      game.obstacles.forEach(obs => {
        const obsSegmentIndex = Math.floor(obs.z / game.segmentLength);
        if (obsSegmentIndex === segmentIndex) {
          const p = project3D(obs.x + segment.curve, segment.y, obs.z, game.camera.x, game.camera.y, game.position);
          if (p.scale > 0 && p.y > 250 && p.y < 800) {
            const w = obs.width * p.scale;
            const h = obs.height * p.scale;
            // Car Body
            ctx.fillStyle = obs.color;
            ctx.fillRect(p.x - w / 2, p.y - h, w, h * 0.6);
            ctx.fillRect(p.x - w / 2 - (w * 0.1), p.y - h * 0.4, w * 1.2, h * 0.4);
            // Windows
            ctx.fillStyle = '#111';
            ctx.fillRect(p.x - w / 3, p.y - h * 0.9, w / 1.5, h * 0.3);
            // Taillights
            ctx.fillStyle = '#ff0000';
            const lightW = w * 0.15;
            const lightH = h * 0.15;
            // Add glow for taillights
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0000';
            ctx.fillRect(p.x - w / 2, p.y - h * 0.3, lightW, lightH);
            ctx.fillRect(p.x + w / 2 - lightW, p.y - h * 0.3, lightW, lightH);
            ctx.shadowBlur = 0; // Reset shadow

            // Car Outline for visibility
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - w / 2, p.y - h, w, h * 0.6);
            ctx.strokeRect(p.x - w / 2 - (w * 0.1), p.y - h * 0.4, w * 1.2, h * 0.4);
            
            // Tires
            ctx.fillStyle = '#000';
            const tireW = w * 0.2;
            const tireH = h * 0.2;
            ctx.fillRect(p.x - w / 2 - tireW / 2, p.y - tireH, tireW, tireH);
            ctx.fillRect(p.x + w / 2 - tireW / 2, p.y - tireH, tireW, tireH);
            
            // Shadow (Better Depth)
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, w * 0.7, h * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // Render Trees in this segment
      game.trees.forEach(tree => {
        const treeSegmentIndex = Math.floor(tree.z / game.segmentLength);
        if (treeSegmentIndex === segmentIndex) {
           const p = project3D(tree.x + segment.curve, segment.y, tree.z, game.camera.x, game.camera.y, game.position);
           if (p.scale > 0 && p.y > 250 && p.y < 800) {
             const w = tree.width * p.scale;
             const h = tree.height * p.scale;
             ctx.fillStyle = colors.trunk;
             ctx.fillRect(p.x - w / 4, p.y - h / 4, w / 2, h / 4);
             ctx.fillStyle = colors.tree;
             ctx.beginPath();
             ctx.moveTo(p.x - w, p.y - h / 4);
             ctx.lineTo(p.x, p.y - h);
             ctx.lineTo(p.x + w, p.y - h / 4);
             ctx.closePath();
             ctx.fill();
           }
        }
      });
      }

      // Speed Lines Effect (High Speed)
      if (player.speed > 220) {
      const speedRatio = Math.min(1, (player.speed - 220) / 60);
      ctx.strokeStyle = `rgba(255, 255, 255, ${speedRatio * 0.3})`;
      ctx.lineWidth = 2;
      const centerX = 400;
      const centerY = 300;

      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const innerR = 100 + Math.random() * 50;
        const outerR = 300 + Math.random() * 200;

        const x1 = centerX + Math.cos(angle) * innerR;
        const y1 = centerY + Math.sin(angle) * innerR;
        const x2 = centerX + Math.cos(angle) * outerR;
        const y2 = centerY + Math.sin(angle) * outerR;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      }

      ctx.restore();

      // Direct Dashboard Rendering (Avoids React Batching Lag)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';    ctx.fillRect(10, 10, 220, 150);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 220, 150);
    
    const displaySpeed = Math.floor(Math.abs(player.speed) * 1.5);
    const speedDisplayStr = player.speed < 0 ? `-${displaySpeed}` : `${displaySpeed}`;
    // Removed unused distanceDisplay
    
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = player.speed < 0 ? '#ef4444' : '#10b981';
    ctx.fillText(`Speed: ${speedDisplayStr} km/h`, 25, 40);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Score: ${Math.floor(game.score)}`, 25, 70);
    
    // Overtakes Status
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Overtakes: ${game.overtakes}`, 25, 95);
    
    const gearDisplay = player.gear === 'forward' ? 'F' : player.gear === 'reverse' ? 'R' : 'N';
    const gearColor = player.gear === 'reverse' ? '#ef4444' : player.gear === 'forward' ? '#10b981' : '#9ca3af';
    ctx.fillStyle = gearColor;
    ctx.font = 'bold 28px Arial';
    ctx.fillText(`Gear: ${gearDisplay}`, 25, 125);
    
    // Boost Meter
    ctx.fillStyle = '#444';
    ctx.fillRect(25, 135, 150, 10);
    ctx.fillStyle = player.boosting ? '#3b82f6' : '#60a5fa';
    ctx.fillRect(25, 135, 150 * (player.boost / 100), 10);
    if (player.boosting) {
       ctx.font = 'italic bold 14px Arial';
       ctx.fillStyle = '#60a5fa';
       ctx.fillText('BOOST!', 185, 145);
    }

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = audioEnabled ? '#10b981' : '#ef4444';
    ctx.fillText(audioEnabled ? '🔊 Audio ON' : '🔇 Audio OFF', 25, 170);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, 560, 780, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText('⬆️ Forward  ⬇️ Reverse  ⬅️➡️ Steer  Shift Boost', 20, 580);

    // CRASH OVERLAY
    if (player.crashed) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(0, 0, 800, 600);
      
      ctx.font = 'bold 80px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText('CRASH!', 400, 300);
      ctx.fillText('CRASH!', 400, 300);
      
      ctx.font = 'bold 24px Arial';
      ctx.strokeText('Press Up/W to Recover', 400, 350);
      ctx.fillText('Press Up/W to Recover', 400, 350);
      ctx.textAlign = 'left'; // Reset
    }
  }, [getColors, project3D, audioEnabled, settings.timeOfDay]);

  useEffect(() => {
    let animationId;
    const gameLoop = () => {
      updateGame();
      render();
      animationId = requestAnimationFrame(gameLoop);
    };
    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [updateGame, render]);

  useEffect(() => {
    const handleKeyDown = (e) => { gameRef.current.keys[e.key] = true; };
    const handleKeyUp = (e) => { gameRef.current.keys[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div style={{
      width: '100%', height: '100vh', backgroundColor: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      <canvas ref={canvasRef} width={800} height={600} style={{
        border: '4px solid #334155', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }} />
      {!audioEnabled && (
        <button onClick={initAudio} style={{
            position: 'absolute', top: '1rem', left: '1rem', padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb', color: 'white', borderRadius: '0.5rem',
            fontWeight: 'bold', fontSize: '1.125rem', display: 'flex',
            alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer',
            animation: 'pulse 2s infinite'
          }}>
          <Volume2 className="w-6 h-6" /> Enable Audio
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }`}</style>
        </button>
      )}
      <button onClick={() => setShowSettings(!showSettings)} style={{
          position: 'absolute', top: '1rem', right: '1rem', padding: '0.75rem',
          backgroundColor: '#1e293b', color: 'white', borderRadius: '0.5rem',
          border: 'none', cursor: 'pointer', display: 'flex'
        }}>
        <Settings className="w-6 h-6" />
      </button>
      {showSettings && (
        <div style={{
          position: 'absolute', top: '4rem', right: '1rem', backgroundColor: '#1e293b',
          border: '2px solid #475569', borderRadius: '0.5rem', padding: '1.5rem', width: '20rem', zIndex: 10
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', margin: '0 0 1rem 0' }}>⚙️ Settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ color: 'white', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Terrain</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <button onClick={() => setSettings({...settings, terrain: 'flat'})} style={{
                    padding: '0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
                    color: 'white', fontSize: '0.75rem', backgroundColor: settings.terrain === 'flat' ? '#16a34a' : '#334155'
                  }}>Flat</button>
                <button onClick={() => setSettings({...settings, terrain: 'hills'})} style={{
                    padding: '0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
                    color: 'white', fontSize: '0.75rem', backgroundColor: settings.terrain === 'hills' ? '#16a34a' : '#334155'
                  }}>Hills</button>
                <button onClick={() => setSettings({...settings, terrain: 'mountains'})} style={{
                    padding: '0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
                    backgroundColor: settings.terrain === 'mountains' ? '#16a34a' : '#334155'
                  }}><Mountain style={{ width: '1rem', height: '1rem', color: 'white', display: 'block', margin: 'auto' }} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlowRoads;