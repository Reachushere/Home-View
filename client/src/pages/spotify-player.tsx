import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Music2, Loader2,
  ChevronLeft, ChevronDown, Shuffle, Repeat, Volume2, VolumeX, Speaker,
  Search, Radio, Menu, X, Home, Zap, Wifi, Star, Volume1,
  Bed, Bath, DoorOpen, CookingPot, Sofa, Crown, ShirtIcon, Globe2,
  Sun, Cast, Monitor, Square,
} from "lucide-react";
import floorplanImg from "@assets/Floorplan11_1774005505273.png";
import massBg from "@assets/mass-background2_1774005959332.png";
import musicBg from "@assets/Music_BG20_1774006032495.png";
import hallwayNight from "@assets/Hallway_Night_1774008796945.png";
import kingNight from "@assets/King_Night_1774008796946.png";
import kitchenNight from "@assets/Kitchen_Night_1774008796947.png";
import livingRoomNight from "@assets/Living_Room_Night_1774008796948.png";
import pugNight from "@assets/Pug_Night_1774008796949.png";
import queenNight from "@assets/Queen_Night_1774008796950.png";
import catNight from "@assets/Cat_Night_1774008796951.png";
import closetNight from "@assets/Closet_Night_1774008796953.png";
import echoSpeakerImg from "@assets/Echo_1774213902054.png";

interface NowPlaying {
  playing: boolean; name?: string; artist?: string; album?: string;
  albumArt?: string; albumArtSmall?: string; progress?: number; duration?: number;
}
interface RoomGroup {
  room: string; icon: string;
  speakers: { id: string; name: string; entityId: string; type: string; room: string }[];
}

interface ProfileArtist {
  name: string; uri: string; image?: string; searchQuery: string;
}

type ProfileKey = "bryn" | "yasu" | "guest";

interface StationShortcut {
  name: string; command: string; uri?: string; icon?: string; image?: string;
}

const STATION_SHORTCUTS: StationShortcut[] = [
  { name: "Gay FM", command: "play Gay FM Radio on tunein on the everywhere group", icon: "📻" },
  { name: "Vibe of Vegas", command: "play the Vibe of Vegas Radio on tunein on the everywhere group", icon: "🎰" },
  { name: "Dinner Jazz", command: "play Dinner Jazz music on Spotify on the everywhere group", icon: "🎷" },
  { name: "Chill Electronic", command: "play Chill Electronic station on Spotify on the everywhere group", icon: "🎧" },
  { name: "CHUM FM", command: "play 104.5 Chum FM", icon: "📡" },
  { name: "Spring Cleaning", command: "play spring cleaning music on Spotify on the everywhere group", icon: "🌸" },
  { name: "Pink", command: "", uri: "spotify:playlist:37i9dQZF1DZ06evO0YT088", icon: "💖" },
  { name: "Easy Listening", command: "play easy listening on Spotify in the everywhere group", icon: "🎵" },
  { name: "Katy Perry", command: "", uri: "spotify:playlist:37i9dQZF1DZ06evO3Jefw4", icon: "🎤" },
  { name: "Disney", command: "play Disney songs on Spotify on the everywhere group", icon: "🏰" },
  { name: "Club Riva", command: "play Club Riva Lounge Radio on tunein on the everywhere group", icon: "🍸" },
  { name: "Samui Island", command: "play Samui Island Radio on tunein", icon: "🌴" },
  { name: "Calm My Cat", command: "Enable Calm My Cat everywhere", icon: "🐱" },
];

const PROFILES: Record<ProfileKey, {
  label: string; artists: ProfileArtist[]; theme: string; accent: string; glow: string;
}> = {
  bryn: {
    label: "Bryn",
    theme: "neon",
    accent: "#3b82f6",
    glow: "rgba(59,130,246,0.3)",
    artists: [
      { name: "Katy Perry", uri: "spotify:artist:6jJ0s89eD6GaHleKKya26X", searchQuery: "Katy Perry" },
      { name: "Pink", uri: "spotify:artist:1KCSPY1glIKqW2TotWuXOR", searchQuery: "Pink singer" },
      { name: "Lady Gaga", uri: "spotify:artist:1HY2Jd0NmPuamShAr6KMms", searchQuery: "Lady Gaga" },
      { name: "Cher", uri: "spotify:artist:72OaDtakiy6yFqkt4TsiFt", searchQuery: "Cher" },
      { name: "CHUM FM", uri: "", searchQuery: "104.5 Chum FM" },
      { name: "Disney", uri: "spotify:playlist:37i9dQZF1DX8C585qnMYHP", searchQuery: "Disney hits" },
      { name: "Chill Electro", uri: "spotify:playlist:37i9dQZF1DX4E3UdUs7fUx", searchQuery: "Chill electronic" },
      { name: "Dinner Jazz", uri: "spotify:playlist:37i9dQZF1DX4wta20PHgwo", searchQuery: "Dinner jazz" },
    ],
  },
  yasu: {
    label: "Yasu",
    theme: "sakura",
    accent: "#38bdf8",
    glow: "rgba(56,189,248,0.35)",
    artists: [
      { name: "中島みゆき", uri: "spotify:artist:7IKFMPUxJDZhKxFGYOawBo", searchQuery: "Miyuki Nakajima" },
      { name: "YOASOBI", uri: "spotify:artist:64tJ2EAv1R6UaZqc4iOCyj", searchQuery: "YOASOBI" },
      { name: "Kenshi Yonezu", uri: "spotify:artist:1snhtMLeb2DYoMOcVkiKnR", searchQuery: "Kenshi Yonezu" },
      { name: "Aimyon", uri: "spotify:artist:5Lak6GhYbSqhRimRYhE0dP", searchQuery: "Aimyon" },
      { name: "ONE OK ROCK", uri: "spotify:artist:7q4KJIqziJOKnsTaFKpMII", searchQuery: "ONE OK ROCK" },
      { name: "Official HIGE DANdism", uri: "spotify:artist:3YMVszTadghiHjPOYaG3PM", searchQuery: "Official HIGE DANdism" },
      { name: "Vaundy", uri: "spotify:artist:6k4bHMbRIf97CqMqmU7Xk4", searchQuery: "Vaundy" },
      { name: "King Gnu", uri: "spotify:artist:6n70eCqbtJhbMgsMet1WVb", searchQuery: "King Gnu" },
      { name: "Aimer", uri: "spotify:artist:0bAsR2unSRpn6BOpSbGhAu", searchQuery: "Aimer" },
      { name: "Tokyo Disney", uri: "spotify:track:2PdJJkPFzhJiMqUOT1GKsj", searchQuery: "Tokyo Disney music" },
    ],
  },
  guest: {
    label: "Guest",
    theme: "neon",
    accent: "#a78bfa",
    glow: "rgba(167,139,250,0.3)",
    artists: [
      { name: "Dua Lipa", uri: "spotify:artist:6M2wZ9GZgrQXHCFfjv46we", searchQuery: "Dua Lipa" },
      { name: "The Weeknd", uri: "spotify:artist:1Xyo4u8uXC1ZmMpatF05PJ", searchQuery: "The Weeknd" },
      { name: "Taylor Swift", uri: "spotify:artist:06HL4z0CvFAxyc27GXpf02", searchQuery: "Taylor Swift" },
      { name: "Ed Sheeran", uri: "spotify:artist:6eUKZXaKkcviH0Ku9w2n3V", searchQuery: "Ed Sheeran" },
      { name: "Billie Eilish", uri: "spotify:artist:6qqNVTkY8uBg9cP3Jd7DAH", searchQuery: "Billie Eilish" },
      { name: "Harry Styles", uri: "spotify:artist:6KImCVD70vtIoJWnq6nGn3", searchQuery: "Harry Styles" },
      { name: "Doja Cat", uri: "spotify:artist:5cj0lLjcoR7YOSnhnX0Po5", searchQuery: "Doja Cat" },
      { name: "SZA", uri: "spotify:artist:7tYKF4w9nC0nq9CsPZTHyP", searchQuery: "SZA" },
    ],
  },
};

const ROOM_JP: Record<string, string> = {
  "Balcony": "バルコニー",
  "Queen Bedroom": "クイーンベッド",
  "Pug Washroom": "パグ洗面所",
  "Hallway": "廊下",
  "Kitchen": "キッチン",
  "Living Room": "リビング",
  "King Bedroom": "キングベッド",
  "Cat Washroom": "猫洗面所",
  "Closet": "クローゼット",
  "Everywhere": "全室",
};

const ROOM_HOTSPOTS: { room: string; x: number; y: number; w: number; h: number; entityId: string; groupEntityId: string; deviceType: string; icon: string; nightImg?: string; labelOffsetX?: number; labelOffsetY?: number; volumeOffsetX?: number; volumeOffsetY?: number; hideLabel?: boolean }[] = [
  { room: "Balcony", x: 2, y: 72, w: 18, h: 25, entityId: "media_player.balcony_speaker", groupEntityId: "media_player.balcony_media_group", deviceType: "echo", icon: "balcony", hideLabel: true },
  { room: "Queen Bedroom", x: 2, y: 38, w: 18, h: 33, entityId: "media_player.queen_bedroom", groupEntityId: "media_player.queen_bedroom_media_group", deviceType: "echo", icon: "bed", nightImg: queenNight, labelOffsetX: -60, labelOffsetY: -50, volumeOffsetX: -40, volumeOffsetY: 0 },
  { room: "Pug Washroom", x: 2, y: 5, w: 16, h: 32, entityId: "media_player.echo_show_pug_am", groupEntityId: "media_player.pug_media_group", deviceType: "echo_show", icon: "bath", nightImg: pugNight, labelOffsetX: -35, labelOffsetY: 35, volumeOffsetX: -15, volumeOffsetY: 115 },
  { room: "Hallway", x: 19, y: 5, w: 16, h: 32, entityId: "media_player.hallway_2", groupEntityId: "media_player.hallway_media_group", deviceType: "echo", icon: "hallway", nightImg: hallwayNight, labelOffsetX: 80, labelOffsetY: -175, volumeOffsetX: 80, volumeOffsetY: -125 },
  { room: "Kitchen", x: 36, y: 5, w: 28, h: 45, entityId: "media_player.kitchen_lr", groupEntityId: "media_player.kitchen_media_group", deviceType: "echo", icon: "kitchen", nightImg: kitchenNight, labelOffsetX: -95, labelOffsetY: -225, volumeOffsetX: -85, volumeOffsetY: -175 },
  { room: "Living Room", x: 36, y: 52, w: 28, h: 45, entityId: "media_player.kitchen_lr", groupEntityId: "media_player.living_room_media_group", deviceType: "echo", icon: "sofa", nightImg: livingRoomNight, labelOffsetX: 60, labelOffsetY: -65, volumeOffsetX: 75, volumeOffsetY: -15 },
  { room: "King Bedroom", x: 65, y: 30, w: 33, h: 50, entityId: "media_player.king_bedroom", groupEntityId: "media_player.king_bedroom_media_group", deviceType: "echo", icon: "crown", nightImg: kingNight, labelOffsetX: 40, labelOffsetY: -314, volumeOffsetX: 50, volumeOffsetY: -264 },
  { room: "Cat Washroom", x: 84, y: 3, w: 14, h: 26, entityId: "media_player.cat_speakers", groupEntityId: "media_player.cat_washroom_media_group", deviceType: "echo", icon: "bath", nightImg: catNight, labelOffsetX: -465, labelOffsetY: -110, volumeOffsetX: -445, volumeOffsetY: -60 },
  { room: "Closet", x: 65, y: 3, w: 18, h: 26, entityId: "media_player.echo_closet_am", groupEntityId: "media_player.closet_media_group", deviceType: "echo", icon: "closet", nightImg: closetNight, labelOffsetX: 30, labelOffsetY: -79, volumeOffsetX: 30, volumeOffsetY: -29 },
  { room: "Everywhere", x: 84, y: 78, w: 14, h: 18, entityId: "media_player.byhome", groupEntityId: "media_player.byhome", deviceType: "echo", icon: "everywhere", labelOffsetX: -40, labelOffsetY: 0, volumeOffsetX: -10, volumeOffsetY: 35 },
];

type ViewMode = "floor" | "stations" | "rooms";

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

const ROOM_SLIDER_COLORS: Record<string, string> = {
  "Queen Bedroom": "#e84393",
  "Pug Washroom": "#00b4d8",
  "Hallway": "#6c5ce7",
  "Kitchen": "#fdcb6e",
  "Living Room": "#0984e3",
  "King Bedroom": "#e17055",
  "Cat Washroom": "#00cec9",
  "Closet": "#a29bfe",
  "Everywhere": "#ff6b6b",
  "Balcony": "#55efc4",
};

function VolumeKnob({ value, onChange, size = 54, accent = "#3b82f6", glow = "rgba(59,130,246,0.3)", roomName }: { value: number; onChange: (v: number) => void; size?: number; accent?: string; glow?: string; roomName?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const sliderColor = roomName ? (ROOM_SLIDER_COLORS[roomName] || accent) : accent;
  const trackWidth = 90;
  const thumbSize = 16;

  const valueFromEvent = (e: { clientX: number }) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.round(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    return pct;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onChange(valueFromEvent(e));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.stopPropagation();
    onChange(valueFromEvent(e));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col items-center gap-1" style={{ touchAction: 'none' }}>
      <div className="flex items-center gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - 5)); }}
          className="text-white font-bold text-[11px] w-4 h-4 flex items-center justify-center rounded-full transition-all hover:scale-125"
          style={{ textShadow: '0 0 4px rgba(255,255,255,0.5)' }}
          data-testid="volume-minus">−</button>
        <div ref={trackRef} className="relative cursor-pointer"
          style={{ width: trackWidth, height: 8 }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <div className="absolute inset-0 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.6)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
            }} />
          <div className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: `${value}%`,
              background: `linear-gradient(90deg, ${sliderColor}cc, ${sliderColor})`,
              boxShadow: `0 0 8px ${sliderColor}60, 0 0 2px ${sliderColor}40`,
              transition: dragging.current ? 'none' : 'width 0.1s ease',
            }} />
          <div className="absolute top-1/2"
            style={{
              left: `calc(${value}% - ${thumbSize / 2}px)`,
              transform: 'translateY(-50%)',
              width: thumbSize,
              height: thumbSize,
              borderRadius: '50%',
              background: `radial-gradient(circle at 40% 35%, rgba(60,60,70,1), rgba(25,25,35,1))`,
              boxShadow: `0 2px 8px rgba(0,0,0,0.7), 0 0 12px ${sliderColor}40, inset 0 1px 1px rgba(255,255,255,0.15)`,
              border: '1px solid rgba(255,255,255,0.1)',
              transition: dragging.current ? 'none' : 'left 0.1s ease',
            }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 5, height: 5, borderRadius: '50%',
              background: sliderColor,
              boxShadow: `0 0 6px ${sliderColor}`,
            }} />
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onChange(Math.min(100, value + 5)); }}
          className="text-white font-bold text-[11px] w-4 h-4 flex items-center justify-center rounded-full transition-all hover:scale-125"
          style={{ textShadow: '0 0 4px rgba(255,255,255,0.5)' }}
          data-testid="volume-plus">+</button>
      </div>
      <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>{value}%</span>
    </div>
  );
}

function CherryBlossoms() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * 2; canvas.height = H * 2;
    ctx.scale(2, 2);

    const petalColors = [
      [255, 183, 197], [255, 192, 210], [255, 175, 195],
      [255, 200, 215], [248, 170, 190], [255, 210, 220],
      [255, 218, 228], [252, 165, 185], [255, 205, 218],
    ];

    interface Petal {
      x: number; y: number; r: number; vx: number; vy: number; vr: number;
      alpha: number; size: number; color: number[]; delay: number;
      wobbleSpeed: number; wobbleAmp: number; flutter: number;
      curl: number; tilt3d: number; tiltSpeed: number;
      shape: number;
    }

    const petals: Petal[] = [];
    for (let i = 0; i < 70; i++) {
      petals.push({
        x: Math.random() * W, y: Math.random() * H * 2 - H,
        r: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.3) * 0.5, vy: 0.15 + Math.random() * 0.55,
        vr: (Math.random() - 0.5) * 0.018,
        alpha: 0.45 + Math.random() * 0.45,
        size: 4 + Math.random() * 10,
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        delay: Math.random() * 6000,
        wobbleSpeed: 2000 + Math.random() * 2500,
        wobbleAmp: 0.4 + Math.random() * 0.8,
        flutter: Math.random() * 0.015,
        curl: 0.2 + Math.random() * 0.6,
        tilt3d: Math.random() * Math.PI * 2,
        tiltSpeed: 800 + Math.random() * 1200,
        shape: Math.floor(Math.random() * 3),
      });
    }

    const drawSinglePetal = (ctx: CanvasRenderingContext2D, s: number, cr: number, cg: number, cb: number, curl: number) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 0.4, -s * 0.6, s * 0.9, -s * 0.5, s * 0.5, -s * 0.05);
      ctx.bezierCurveTo(s * 0.9, s * (0.4 + curl * 0.2), s * 0.4, s * 0.55, 0, 0);
      const grad = ctx.createLinearGradient(0, -s * 0.5, s * 0.3, s * 0.3);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.92)`);
      grad.addColorStop(0.5, `rgba(${Math.min(cr+15,255)},${Math.min(cg+10,255)},${Math.min(cb+10,255)},0.85)`);
      grad.addColorStop(1, `rgba(${cr-15},${cg-10},${cb-8},0.75)`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.35, -s * 0.15, s * 0.5, -s * 0.05);
      ctx.strokeStyle = `rgba(${cr-30},${cg-25},${cb-20},0.25)`;
      ctx.lineWidth = 0.4;
      ctx.stroke();
    };

    const drawPetal = (ctx: CanvasRenderingContext2D, p: Petal, t: number) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      const tilt = Math.sin((t + p.delay) / p.tiltSpeed) * 0.5;
      ctx.scale(1, 0.4 + Math.abs(Math.cos(tilt)) * 0.6);
      ctx.globalAlpha = p.alpha * (0.7 + Math.abs(Math.cos(tilt)) * 0.3);

      const [cr, cg, cb] = p.color;
      const s = p.size;

      if (p.shape === 0) {
        drawSinglePetal(ctx, s, cr, cg, cb, p.curl);
      } else if (p.shape === 1) {
        ctx.save();
        drawSinglePetal(ctx, s, cr, cg, cb, p.curl);
        ctx.rotate(Math.PI * 0.4);
        drawSinglePetal(ctx, s * 0.85, cr, cg, cb, p.curl);
        ctx.restore();
      } else {
        for (let i = 0; i < 5; i++) {
          ctx.save();
          ctx.rotate((i / 5) * Math.PI * 2);
          drawSinglePetal(ctx, s * 0.7, cr, cg, cb, p.curl);
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,225,180,0.9)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.06, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,180,120,0.7)`;
        ctx.fill();
      }

      ctx.globalAlpha = p.alpha * 0.15;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
      glow.addColorStop(0, `rgba(${cr},${cg},${cb},0.2)`);
      glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.restore();
    };

    const animate = () => {
      const t = Date.now();
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        const windGust = Math.sin(t / 8000) * 0.3 + Math.sin(t / 3000 + p.delay) * 0.15;
        p.x += p.vx + Math.sin((t + p.delay) / p.wobbleSpeed) * p.wobbleAmp + windGust;
        p.y += p.vy + Math.sin((t + p.delay) / 2500) * 0.1;
        p.r += p.vr + Math.sin((t + p.delay) / 1800) * p.flutter;
        if (p.y > H + 30) { p.y = -30; p.x = Math.random() * W; }
        if (p.x > W + 40) p.x = -40;
        if (p.x < -40) p.x = W + 40;
        drawPetal(ctx, p, t);
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 40 }} />;
}

function JapaneseWaves({ accent }: { accent: string }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden" style={{ height: 80, zIndex: 1, opacity: 0.12 }}>
      <svg viewBox="0 0 1920 80" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <pattern id="seigaiha" x="0" y="0" width="60" height="30" patternUnits="userSpaceOnUse">
            <path d="M30 30 Q30 0 0 0" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.6" />
            <path d="M30 30 Q30 0 60 0" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.6" />
            <path d="M30 30 Q30 5 5 5" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.4" />
            <path d="M30 30 Q30 5 55 5" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.4" />
            <path d="M30 30 Q30 10 10 10" fill="none" stroke={accent} strokeWidth="0.4" opacity="0.3" />
            <path d="M30 30 Q30 10 50 10" fill="none" stroke={accent} strokeWidth="0.4" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="1920" height="80" fill="url(#seigaiha)" />
      </svg>
    </div>
  );
}

function HoloCircuitLines({ accent, sakura = false }: { accent: string; sakura?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * 2; canvas.height = H * 2;
    ctx.scale(2, 2);

    interface CircuitPath { points: { x: number; y: number }[]; speed: number; offset: number }
    const paths: CircuitPath[] = [];
    for (let i = 0; i < 30; i++) {
      const pts: { x: number; y: number }[] = [];
      let cx = Math.random() * W, cy = Math.random() * H;
      pts.push({ x: cx, y: cy });
      const segs = 3 + Math.floor(Math.random() * 5);
      for (let s = 0; s < segs; s++) {
        if (Math.random() > 0.5) cx += (Math.random() - 0.3) * 200;
        else cy += (Math.random() - 0.3) * 150;
        cx = Math.max(0, Math.min(W, cx));
        cy = Math.max(0, Math.min(H, cy));
        pts.push({ x: cx, y: cy });
      }
      paths.push({ points: pts, speed: 0.3 + Math.random() * 1.2, offset: Math.random() * Math.PI * 2 });
    }

    const nodes: { x: number; y: number; pulseOffset: number; size: number }[] = [];
    for (let i = 0; i < 40; i++) {
      nodes.push({ x: Math.random() * W, y: Math.random() * H, pulseOffset: Math.random() * Math.PI * 2, size: 1 + Math.random() * 2 });
    }

    const junctions: { x: number; y: number; size: number; pulseOffset: number }[] = [];
    for (let i = 0; i < 15; i++) {
      junctions.push({ x: Math.random() * W, y: Math.random() * H, size: 3 + Math.random() * 4, pulseOffset: Math.random() * Math.PI * 2 });
    }

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;

      for (const path of paths) {
        const alpha = 0.1 + Math.sin(t * path.speed + path.offset) * 0.06;
        ctx.strokeStyle = `${accent}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let p = 0; p < path.points.length; p++) {
          if (p === 0) ctx.moveTo(path.points[p].x, path.points[p].y);
          else ctx.lineTo(path.points[p].x, path.points[p].y);
        }
        ctx.stroke();

        let totalLen = 0;
        for (let p = 1; p < path.points.length; p++) {
          totalLen += Math.hypot(path.points[p].x - path.points[p-1].x, path.points[p].y - path.points[p-1].y);
        }
        const travelDist = ((t * path.speed * 40 + path.offset * 100) % totalLen);
        let accum = 0;
        for (let p = 1; p < path.points.length; p++) {
          const segLen = Math.hypot(path.points[p].x - path.points[p-1].x, path.points[p].y - path.points[p-1].y);
          if (accum + segLen >= travelDist) {
            const frac = (travelDist - accum) / segLen;
            const px = path.points[p-1].x + (path.points[p].x - path.points[p-1].x) * frac;
            const py = path.points[p-1].y + (path.points[p].y - path.points[p-1].y) * frac;
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `${accent}60`;
            ctx.fill();
            const grd = ctx.createRadialGradient(px, py, 0, px, py, 8);
            grd.addColorStop(0, `${accent}30`);
            grd.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();
            break;
          }
          accum += segLen;
        }

        for (const pt of path.points) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `${accent}25`;
          ctx.fill();
        }
      }

      for (const junc of junctions) {
        const pulse = Math.sin(t * 1.5 + junc.pulseOffset) * 0.5 + 0.5;
        const s = junc.size;
        ctx.strokeStyle = `${accent}${Math.round((0.08 + pulse * 0.12) * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(junc.x - s / 2, junc.y - s / 2, s, s);
        ctx.beginPath();
        ctx.arc(junc.x, junc.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `${accent}${Math.round((0.15 + pulse * 0.2) * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
      }

      for (const node of nodes) {
        const pulse = Math.sin(t * 2 + node.pulseOffset) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + pulse * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `${accent}${Math.round((0.08 + pulse * 0.14) * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [accent]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0, opacity: sakura ? 0.4 : 0.85 }} />;
}

function HoloScanLine() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '2px',
        background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.15), transparent)',
        animation: 'holoScan 4s linear infinite',
      }} />
    </div>
  );
}

function HoloVinyl({ albumArt, playing, accent, size = 220 }: { albumArt?: string; playing: boolean; accent: string; size?: number }) {
  const rotRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  useEffect(() => {
    if (playing && !wasPlayingRef.current) {
      rotRef.current = 0;
    }
    wasPlayingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = size * 2; canvas.height = size * 2;
    ctx.scale(2, 2);
    const cx = size / 2, cy = size / 2;

    let imgEl: HTMLImageElement | null = null;
    if (albumArt) { imgEl = new Image(); imgEl.crossOrigin = "anonymous"; imgEl.src = albumArt; }

    const animate = () => {
      ctx.clearRect(0, 0, size, size);
      if (playing) rotRef.current += 0.015;
      const t = Date.now() / 1000;

      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotRef.current);
      const R = size * 0.42;

      const outerGlow = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.1);
      outerGlow.addColorStop(0, 'transparent');
      outerGlow.addColorStop(0.5, playing ? `${accent}15` : 'transparent');
      outerGlow.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(0, 0, R * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow; ctx.fill();

      const vg = ctx.createRadialGradient(0, 0, R * 0.35, 0, 0, R);
      vg.addColorStop(0, "#142540"); vg.addColorStop(0.3, "#182d48"); vg.addColorStop(0.6, "#122240"); vg.addColorStop(1, "#0e1c35");
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = vg; ctx.fill();

      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.strokeStyle = playing ? `${accent}40` : 'rgba(0,180,255,0.15)';
      ctx.lineWidth = 1.5; ctx.stroke();

      for (let g = 0; g < 24; g++) {
        const r = R * 0.35 + g * (R * 0.028);
        if (r > R) break;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        const baseHue = playing ? 200 : 210;
        const hue = (baseHue + g * 8 + (playing ? t * 30 : 0)) % 360;
        const alpha = playing
          ? 0.08 + Math.sin(t * 3 + g * 0.5) * 0.05
          : 0.03 + Math.sin(t * 0.5 + g * 0.3) * 0.015;
        ctx.strokeStyle = `hsla(${hue},80%,60%,${alpha})`;
        ctx.lineWidth = 0.5; ctx.stroke();
      }

      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i + t * 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * R * 0.36, Math.sin(angle) * R * 0.36);
        ctx.lineTo(Math.cos(angle) * R * 0.95, Math.sin(angle) * R * 0.95);
        ctx.strokeStyle = playing ? `${accent}10` : 'rgba(0,180,255,0.04)';
        ctx.lineWidth = 0.3; ctx.stroke();
      }

      const lr = R * 0.33;
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(imgEl, -lr, -lr, lr * 2, lr * 2);
        ctx.restore();
        ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2);
        ctx.strokeStyle = playing ? `${accent}50` : 'rgba(0,180,255,0.2)';
        ctx.lineWidth = 1; ctx.stroke();
      } else {
        const labelGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, lr);
        labelGrad.addColorStop(0, playing ? accent : '#1a3560');
        labelGrad.addColorStop(1, playing ? `${accent}80` : '#122850');
        ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2);
        ctx.fillStyle = labelGrad; ctx.fill();
        ctx.strokeStyle = 'rgba(0,180,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      }

      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,200,255,0.4)"; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fill();

      ctx.restore();

      if (playing) {
        for (let i = 0; i < 3; i++) {
          const ringR = R + 6 + i * 10;
          const alpha = 0.12 + Math.sin(t * 2 + i * 1.2) * 0.08;
          ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `${accent}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 1; ctx.stroke();
        }

        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 / 8) * i + t * 0.5;
          const eqH = 4 + Math.sin(t * 4 + i * 0.8) * 8;
          const eqR = R + 20;
          const px = cx + Math.cos(angle) * eqR;
          const py = cy + Math.sin(angle) * eqR;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle + Math.PI / 2);
          ctx.fillStyle = `${accent}${Math.round((0.3 + Math.sin(t * 3 + i) * 0.2) * 255).toString(16).padStart(2, '0')}`;
          ctx.fillRect(-1, -eqH / 2, 2, eqH);
          ctx.restore();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [albumArt, playing, accent, size]);

  return <canvas ref={canvasRef} style={{ width: size * 0.85, height: size * 0.85 }} data-testid="spinning-vinyl" />;
}

function RoomIcon({ icon, size = 18, color }: { icon: string; size?: number; color: string }) {
  const props = { className: "flex-shrink-0", style: { width: size, height: size, color, filter: `drop-shadow(0 0 4px ${color})` } };
  switch (icon) {
    case "bed": return <Bed {...props} />;
    case "bath": return <Bath {...props} />;
    case "hallway": return <DoorOpen {...props} />;
    case "kitchen": return <CookingPot {...props} />;
    case "sofa": return <Sofa {...props} />;
    case "crown": return <Crown {...props} />;
    case "closet": return <ShirtIcon {...props} />;
    case "everywhere": return <Globe2 {...props} />;
    case "balcony": return <Sun {...props} />;
    default: return <Speaker {...props} />;
  }
}

function HoloPanel({ children, className = "", accent, glow = false, style = {}, sakura = false, ...rest }: {
  children: React.ReactNode; className?: string; accent: string; glow?: boolean; style?: React.CSSProperties; sakura?: boolean;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'style'>) {
  const bg = sakura ? 'rgba(22,50,82,0.7)' : 'rgba(25,50,95,0.75)';
  const borderIdle = sakura ? 'rgba(56,189,248,0.35)' : 'rgba(80,160,255,0.3)';
  const innerGlowIdle = sakura ? 'rgba(40,100,160,0.25)' : 'rgba(30,70,140,0.2)';
  const topLineIdle = sakura ? 'rgba(56,189,248,0.5)' : 'rgba(80,180,255,0.4)';
  const gradTop = sakura ? 'rgba(50,170,245,0.12)' : 'rgba(60,140,255,0.08)';
  const gradBot = sakura ? 'rgba(45,160,235,0.08)' : 'rgba(50,120,240,0.06)';
  return (
    <div {...rest} className={`relative rounded-xl overflow-hidden ${className}`} style={{
      background: bg,
      backdropFilter: 'blur(30px)',
      border: `1px solid ${glow ? accent + '60' : borderIdle}`,
      boxShadow: glow
        ? `0 0 30px ${accent}30, inset 0 1px 0 ${sakura ? 'rgba(56,189,248,0.22)' : 'rgba(80,180,255,0.2)'}, inset 0 0 60px ${innerGlowIdle}`
        : `inset 0 1px 0 ${sakura ? 'rgba(56,189,248,0.18)' : 'rgba(80,180,255,0.15)'}, inset 0 0 40px ${innerGlowIdle}`,
      ...style,
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `linear-gradient(180deg, ${gradTop} 0%, transparent 30%, transparent 70%, ${gradBot} 100%)`,
      }} />
      <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none" style={{
        background: `linear-gradient(90deg, transparent, ${glow ? accent + '70' : topLineIdle}, transparent)`,
      }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default function SpotifyPlayerPage() {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [volume, setVolume] = useState(50);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [rooms, setRooms] = useState<RoomGroup[]>([]);
  const [activeProfile, setActiveProfile] = useState<ProfileKey>(() => {
    const p = new URLSearchParams(window.location.search).get("auth");
    if (p && (p === "bryn" || p === "yasu" || p === "guest")) return p;
    return "bryn";
  });
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});
  const [dragItem, setDragItem] = useState<{ type: "artist" | "room" | "speaker"; data: any } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<{ name: string; entityId: string; room: string; type: string }[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<ProfileArtist | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [profileSpinning, setProfileSpinning] = useState(false);
  const [activeRooms, setActiveRooms] = useState<Set<string>>(new Set());
  const [roomVolumes, setRoomVolumes] = useState<Record<string, number>>({});
  const volumeTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("floor");
  const [viewSpinning, setViewSpinning] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [expandedSpeaker, setExpandedSpeaker] = useState<string | null>(null);
  const [floorSpeakerPopup, setFloorSpeakerPopup] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<{ name: string; image: string; uri: string; id: string }[]>([]);
  const [recoIndex, setRecoIndex] = useState(0);
  const [voiceConfirm, setVoiceConfirm] = useState(() => { const v = localStorage.getItem("holomusic-voice"); return v === null ? true : v === "true"; });
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFlickMenu, setShowFlickMenu] = useState(false);
  const [flickDeviceGroups, setFlickDeviceGroups] = useState<Array<{room: string; icon: string; devices: Array<{id: string; name: string; entityId: string; type: string; canDisplay: boolean; room: string}>}>>([]);
  const [isFlicking, setIsFlicking] = useState(false);
  const [jaTranslations, setJaTranslations] = useState<Record<string, string>>({});
  const jaTranslationCache = useRef<Record<string, string>>({});
  const jaTranslationPending = useRef<Set<string>>(new Set());

  const searchParams = new URLSearchParams(window.location.search);
  const authParam = searchParams.get("auth");
  const authQuery = authParam ? `?auth=${authParam}` : "";
  const isEmbedded = searchParams.get("embed") === "true";
  const profile = PROFILES[activeProfile];
  const notifTimeout = useRef<any>(null);
  const searchTimeout = useRef<any>(null);

  const showNotif = (msg: string) => {
    setNotification(msg);
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), 3000);
  };

  const announceTrack = useCallback((trackName: string, artistName: string, roomName?: string) => {
    if (!voiceConfirm || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const lang = activeProfile === "yasu" ? "ja-JP" : "en-US";
    const text = activeProfile === "yasu"
      ? roomName
        ? `${artistName}の${trackName}を${roomName}で再生します`
        : `${artistName}の${trackName}を再生します`
      : roomName
        ? `Now playing ${trackName} by ${artistName} on the ${roomName}`
        : `Now playing ${trackName} by ${artistName}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.volume = 0.7;
    window.speechSynthesis.speak(utter);
  }, [voiceConfirm, activeProfile]);

  const toggleVoiceConfirm = () => {
    const next = !voiceConfirm;
    setVoiceConfirm(next);
    localStorage.setItem("holomusic-voice", String(next));
    const isJp = activeProfile === "yasu";
    showNotif(next ? (isJp ? "音声確認オン" : "Voice confirmations on") : (isJp ? "音声確認オフ" : "Voice confirmations off"));
  };

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/now-playing${authQuery}`);
      if (res.ok) { const d = await res.json(); setNowPlaying(d); if (d.progress) setLocalProgress(d.progress); }
    } catch {} finally { setLoading(false); }
  }, [authQuery]);

  const fetchRooms = useCallback(async () => {
    try { const res = await fetch(`/api/spotify/rooms${authQuery}`); if (res.ok) setRooms(await res.json()); } catch {}
  }, [authQuery]);

  const fetchPlaybackState = useCallback(async () => {
    try {
      const res = await fetch(`/api/spotify/playback-state${authQuery}`);
      if (res.ok) {
        const d = await res.json();
        if (d.active) {
          setVolume(d.volume); setShuffleOn(d.shuffle); setRepeatMode(d.repeat);
          const dn = (d.deviceName || "").toLowerCase();
          if (dn === "byhome" || dn.includes("everywhere")) {
            setActiveRooms(prev => { const n = new Set(prev); n.add("Everywhere"); return n; });
          } else {
            const matchedRoom = ROOM_HOTSPOTS.find(spot => {
              const eid = spot.entityId.toLowerCase();
              return eid.includes(dn.replace(/[^a-z0-9]/g, ''));
            });
            if (matchedRoom) {
              setActiveRooms(prev => { const n = new Set(prev); n.add(matchedRoom.room); return n; });
            }
          }
        }
      }
    } catch {}
  }, [authQuery]);

  const artistIdsRef = useRef<Record<string, string>>({});

  const fetchArtistImages = useCallback(async () => {
    const profileArtists = [...PROFILES.bryn.artists, ...PROFILES.yasu.artists, ...PROFILES.guest.artists];
    const stationItems = STATION_SHORTCUTS.filter(s => s.uri).map(s => ({ name: s.name, uri: s.uri!, searchQuery: s.name }));
    const all = [...profileArtists, ...stationItems];
    const uniqueItems = all.filter((a, i, arr) => arr.findIndex(x => x.name === a.name) === i);
    try {
      const res = await fetch(`/api/spotify/bulk-images${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uniqueItems.map(a => ({ name: a.name, uri: a.uri, searchQuery: a.searchQuery || a.name })) }),
      });
      if (res.ok) {
        const data = await res.json();
        setArtistImages(data.images || {});
        artistIdsRef.current = data.ids || {};
        fetchRecommendations(data.ids || {});
        return;
      }
    } catch {}
    const imgs: Record<string, string> = {};
    const ids: Record<string, string> = {};
    for (const a of uniqueItems) {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(a.searchQuery)}&${authQuery.slice(1)}`);
        if (res.ok) {
          const data = await res.json();
          const artist = data.artists?.[0];
          const img = artist?.image || data.tracks?.[0]?.image || "";
          if (img) imgs[a.name] = img;
          if (artist?.id) ids[a.name] = artist.id;
        }
      } catch {}
    }
    setArtistImages(imgs);
    artistIdsRef.current = ids;
    fetchRecommendations(ids);
  }, [authQuery]);

  const fetchRecommendations = useCallback(async (ids: Record<string, string>) => {
    const currentArtists = activeProfile === "bryn" ? PROFILES.bryn.artists : PROFILES.yasu.artists;
    const seedArtist = currentArtists[Math.floor(Math.random() * currentArtists.length)];
    const artistId = ids[seedArtist.name];
    if (!artistId) return;
    try {
      const res = await fetch(`/api/spotify/related-artists?artistId=${artistId}&${authQuery.slice(1)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.artists?.length) setRecommendations(data.artists);
      }
    } catch {}
  }, [authQuery, activeProfile]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&${authQuery.slice(1)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults([...(data.tracks || []).slice(0, 6), ...(data.artists || []).slice(0, 4)]);
      }
    } catch {} finally { setSearching(false); }
  }, [authQuery]);

  useEffect(() => {
    fetchNowPlaying(); fetchRooms(); fetchPlaybackState(); fetchArtistImages();
    fetch("/api/flick-devices").then(r => r.ok ? r.json() : []).then(groups => setFlickDeviceGroups(groups)).catch(() => {});
    const interval = setInterval(fetchNowPlaying, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSpotifyFlick = async (deviceId: string) => {
    setIsFlicking(true);
    try {
      const resp = await fetch(`/api/spotify/flick${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await resp.json();
      if (data.success) {
        showNotif(isSakura ? `${data.device}に転送しました` : `Sent to ${data.device} in ${data.room}`);
      } else {
        showNotif(data.error || "Flick failed");
      }
    } catch (e: any) {
      showNotif("Flick failed");
    } finally {
      setIsFlicking(false);
      setShowFlickMenu(false);
    }
  };

  const handleStopAll = async () => {
    setActionPending(true);
    try {
      await fetch(`/api/spotify/stop-all${authQuery}`, { method: "POST" });
      showNotif(isSakura ? "全停止" : "All playback stopped");
      setTimeout(fetchNowPlaying, 600);
    } catch {} finally { setActionPending(false); }
  };

  useEffect(() => {
    if (recommendations.length <= 1) return;
    const timer = setInterval(() => {
      setRecoIndex(prev => (prev + 1) % recommendations.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [recommendations.length]);

  useEffect(() => {
    if (nowPlaying?.playing) {
      const tick = setInterval(() => {
        setLocalProgress(p => { const n = p + 500; return nowPlaying.duration && n > nowPlaying.duration ? nowPlaying.duration : n; });
      }, 500);
      return () => clearInterval(tick);
    }
  }, [nowPlaying?.playing, nowPlaying?.duration]);

  const setRoomVolume = useCallback((room: string, vol: number) => {
    setRoomVolumes(prev => ({ ...prev, [room]: vol }));
    const spot = ROOM_HOTSPOTS.find(h => h.room === room);
    if (!spot) return;
    if (volumeTimerRef.current[room]) clearTimeout(volumeTimerRef.current[room]);
    volumeTimerRef.current[room] = setTimeout(() => {
      fetch(`/api/media/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: spot.groupEntityId, level: vol }),
      });
    }, 200);
  }, []);

  const doAction = async (action: string, method = "POST", body?: any) => {
    setActionPending(true);
    try {
      await fetch(`/api/spotify/${action}${authQuery}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      setTimeout(fetchNowPlaying, 600);
    } catch {} finally { setActionPending(false); }
  };

  const playOnRoom = async (roomName: string, artistData: ProfileArtist) => {
    const hotspot = ROOM_HOTSPOTS.find(h => h.room === roomName);
    const roomGroup = rooms.find(r => r.room === roomName);
    const groupSpeaker = roomGroup?.speakers.find(s => s.type === "group") || roomGroup?.speakers[0];
    const entityId = groupSpeaker?.entityId || hotspot?.groupEntityId || hotspot?.entityId;
    const deviceType = hotspot?.deviceType || "echo";
    if (!entityId) { showNotif(`No speakers in ${roomName}`); return; }
    const isJp = activeProfile === "yasu";
    const announceMessage = isJp
      ? `${artistData.name}を${ROOM_JP[roomName] || roomName}で再生します`
      : `Now playing ${artistData.name} on the ${roomName}`;
    console.log(`[PlayOnRoom] ${roomName}: entity=${entityId}, device=${deviceType}, artist=${artistData.name}, uri=${artistData.uri}, searchQuery=${artistData.searchQuery}`);
    try {
      const resp = await fetch(`/api/spotify/play-on-speaker${authQuery}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, spotifyUri: artistData.uri, artistName: artistData.name, searchQuery: artistData.searchQuery, deviceType, announceMessage }),
      });
      const data = await resp.json();
      console.log(`[PlayOnRoom] Response: ${resp.status}`, data);
      setActiveRooms(prev => new Set(prev).add(roomName));
      showNotif(`Playing ${artistData.name} in ${roomName}`);
      setTimeout(fetchNowPlaying, 1500);
    } catch (err) { console.error("[PlayOnRoom] Error:", err); showNotif("Failed to play"); }
  };

  const playStation = async (station: StationShortcut) => {
    if (station.uri) {
      try {
        await fetch(`/api/spotify/play-context${authQuery}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contextUri: station.uri, shuffle: true }),
        });
        announceTrack(station.name, "");
        showNotif(`Playing ${station.name}`);
        setTimeout(fetchNowPlaying, 1000);
      } catch { showNotif("Failed to play station"); }
    } else if (station.command) {
      showNotif(`${station.name} (voice command)`);
    }
  };

  const groupRooms = async (sourceRoom: string, targetRoom: string) => {
    const src = rooms.find(r => r.room === sourceRoom);
    const tgt = rooms.find(r => r.room === targetRoom);
    if (!src || !tgt) return;
    const srcSpeaker = src.speakers.find(s => s.type === "group") || src.speakers[0];
    const tgtSpeaker = tgt.speakers.find(s => s.type === "group") || tgt.speakers[0];
    try {
      await fetch(`/api/spotify/group-speakers${authQuery}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceEntityId: srcSpeaker.entityId, targetEntityId: tgtSpeaker.entityId }),
      });
      setActiveRooms(prev => { const n = new Set(prev); n.add(sourceRoom); n.add(targetRoom); return n; });
      showNotif(`Grouped ${sourceRoom} + ${targetRoom}`);
    } catch { showNotif("Failed to group"); }
  };

  const ungroupRoom = async (roomName: string) => {
    const hotspot = ROOM_HOTSPOTS.find(h => h.room === roomName);
    const roomGroup = rooms.find(r => r.room === roomName);
    const speaker = roomGroup?.speakers.find(s => s.type === "group") || roomGroup?.speakers[0];
    const entityId = speaker?.entityId || hotspot?.groupEntityId || hotspot?.entityId;
    if (!entityId) return;
    try {
      await fetch(`/api/spotify/ungroup-speaker${authQuery}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      setActiveRooms(prev => { const n = new Set(prev); n.delete(roomName); return n; });
      showNotif(`Ungrouped ${roomName}`);
    } catch { showNotif("Failed to ungroup"); }
  };

  const handleDragStart = (type: "artist" | "room" | "speaker", data: any) => (e: React.DragEvent) => {
    console.log(`[DnD] Drag started: ${type} = ${data?.name || data?.room}`);
    setDragItem({ type, data });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, data }));
    if (type === "artist" && viewMode !== "floor") {
      switchView("floor");
    }
  };

  const handleRoomDrop = (roomName: string) => (e: React.DragEvent) => {
    e.preventDefault(); setDropTarget(null);
    console.log(`[DnD] Dropped on room: ${roomName}`);
    try {
      const raw = e.dataTransfer.getData("text/plain");
      const parsed = JSON.parse(raw);
      console.log(`[DnD] Parsed drop data:`, parsed.type, parsed.data?.name || parsed.data?.room);
      if (parsed.type === "artist") playOnRoom(roomName, parsed.data);
      else if (parsed.type === "room" && parsed.data.room !== roomName) groupRooms(parsed.data.room, roomName);
    } catch (err) {
      console.error(`[DnD] Drop parse error:`, err);
    }
    setDragItem(null);
  };

  const handleDragOver = (roomName: string) => (e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(roomName);
  };

  const [playerDropHighlight, setPlayerDropHighlight] = useState(false);
  const handlePlayerDrop = (e: React.DragEvent) => {
    e.preventDefault(); setPlayerDropHighlight(false);
    try {
      const raw = e.dataTransfer.getData("text/plain");
      const parsed = JSON.parse(raw);
      if (parsed.type === "speaker") {
        const spk = parsed.data;
        setActiveSpeakers(prev => {
          if (prev.some(s => s.entityId === spk.entityId)) return prev;
          return [...prev, { name: spk.name, entityId: spk.entityId, room: spk.room, type: spk.type }];
        });
        if (selectedArtist) {
          playOnRoom(spk.room, selectedArtist);
        } else if (isPlaying && nowPlaying) {
          playOnRoom(spk.room, { name: nowPlaying.artist || "", uri: "", searchQuery: nowPlaying.artist || "" });
        }
        setActiveRooms(prev => new Set(prev).add(spk.room));
        showNotif(`${isSakura ? "スピーカー追加" : "Added"} ${spk.name}`);
        setFloorSpeakerPopup(null);
      }
    } catch (err) { console.error("[DnD] Player drop error:", err); }
    setDragItem(null);
  };
  const handlePlayerDragOver = (e: React.DragEvent) => {
    if (dragItem?.type === "speaker") {
      e.preventDefault(); e.dataTransfer.dropEffect = "move"; setPlayerDropHighlight(true);
    }
  };

  const touchDragRef = useRef<{
    type: "artist" | "room";
    data: any;
    startX: number;
    startY: number;
    isDragging: boolean;
    ghostEl: HTMLDivElement | null;
    movedEnough: boolean;
    currentDropRoom: string | null;
  } | null>(null);

  const cleanupTouchDrag = useCallback(() => {
    if (touchDragRef.current?.ghostEl) {
      touchDragRef.current.ghostEl.remove();
    }
    touchDragRef.current = null;
    setDropTarget(null);
    setDragItem(null);
  }, []);

  const handleTouchStart = (type: "artist" | "room", data: any) => (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchDragRef.current = {
      type,
      data,
      startX: touch.clientX,
      startY: touch.clientY,
      isDragging: false,
      ghostEl: null,
      movedEnough: false,
      currentDropRoom: null,
    };
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const td = touchDragRef.current;
    if (!td) return;
    const touch = e.touches[0];
    const dx = touch.clientX - td.startX;
    const dy = touch.clientY - td.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!td.movedEnough && dist > 15) {
      td.movedEnough = true;
      td.isDragging = true;
      setDragItem({ type: td.type, data: td.data });
      if (td.type === "artist" && viewMode !== "floor") {
        switchView("floor");
      }
      const ghost = document.createElement("div");
      ghost.style.cssText = `
        position:fixed; z-index:9999; pointer-events:none;
        padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600;
        color:#fff; background:rgba(59,130,246,0.85); backdrop-filter:blur(8px);
        box-shadow:0 0 20px rgba(59,130,246,0.5); white-space:nowrap;
        transform:translate(-50%,-50%);
      `;
      ghost.textContent = td.data?.name || td.data?.room || "?";
      document.body.appendChild(ghost);
      td.ghostEl = ghost;
      console.log(`[DnD-Touch] Drag started: ${td.type} = ${td.data?.name || td.data?.room}`);
    }

    if (td.isDragging && td.ghostEl) {
      e.preventDefault();
      td.ghostEl.style.left = `${touch.clientX}px`;
      td.ghostEl.style.top = `${touch.clientY}px`;

      const els = document.elementsFromPoint(touch.clientX, touch.clientY);
      let foundRoom: string | null = null;
      for (const el of els) {
        const hotspotEl = (el as HTMLElement).closest("[data-room-hotspot]") as HTMLElement | null;
        if (hotspotEl) {
          foundRoom = hotspotEl.dataset.roomHotspot || null;
          break;
        }
      }
      td.currentDropRoom = foundRoom;
      setDropTarget(foundRoom);
    }
  }, [viewMode]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    const td = touchDragRef.current;
    if (!td) return;

    if (td.isDragging && td.movedEnough) {
      const room = td.currentDropRoom;
      if (room) {
        console.log(`[DnD-Touch] Dropped on room: ${room}`);
        if (td.type === "artist") playOnRoom(room, td.data);
        else if (td.type === "room" && td.data.room !== room) groupRooms(td.data.room, room);
      } else {
        console.log(`[DnD-Touch] Dropped outside any room`);
      }
    }
    cleanupTouchDrag();
  }, [cleanupTouchDrag]);

  const switchProfile = (p: ProfileKey) => {
    if (p === activeProfile) return;
    setProfileSpinning(true);
    setTimeout(() => { setActiveProfile(p); setSelectedArtist(null); setTimeout(() => setProfileSpinning(false), 50); }, 350);
  };

  const switchView = (v: ViewMode) => {
    if (v === viewMode) return;
    setViewSpinning(true);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setTimeout(() => { setViewMode(v); setTimeout(() => setViewSpinning(false), 50); }, 300);
  };

  const isPlaying = !!nowPlaying?.playing;
  const progressPct = nowPlaying?.duration ? (localProgress / nowPlaying.duration) * 100 : 0;
  const isSakura = activeProfile === "yasu";

  useEffect(() => {
    if (!isSakura || !nowPlaying) return;
    const textsToTranslate: string[] = [];
    const addIfNeeded = (t?: string) => {
      if (t && !jaTranslationCache.current[t] && !jaTranslationPending.current.has(t)) {
        textsToTranslate.push(t);
      }
    };
    addIfNeeded(nowPlaying.name);
    addIfNeeded(nowPlaying.album);
    if (textsToTranslate.length === 0) return;
    textsToTranslate.forEach(t => jaTranslationPending.current.add(t));
    const timer = setTimeout(() => {
      fetch("/api/translate-ja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: textsToTranslate }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.translations) {
            jaTranslationCache.current = { ...jaTranslationCache.current, ...data.translations };
            setJaTranslations(prev => ({ ...prev, ...data.translations }));
          }
          textsToTranslate.forEach(t => jaTranslationPending.current.delete(t));
        })
        .catch(() => {
          textsToTranslate.forEach(t => jaTranslationPending.current.delete(t));
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [isSakura, nowPlaying?.name, nowPlaying?.album]);

  const ja = (text?: string) => {
    if (!text || !isSakura) return text;
    return jaTranslations[text] || text;
  };

  const tc = {
    textMuted: isSakura ? 'rgba(150,210,248,0.8)' : 'rgba(100,180,255,0.65)',
    textSoft: isSakura ? 'rgba(160,220,250,0.6)' : 'rgba(100,180,255,0.45)',
    textMid: isSakura ? 'rgba(140,210,248,0.9)' : 'rgba(140,200,255,0.8)',
    textBright: isSakura ? 'rgba(170,225,255,0.95)' : 'rgba(140,200,255,0.85)',
    navIdle: isSakura ? 'rgba(120,210,250,0.8)' : 'rgba(120,200,255,0.65)',
    menuToggle: isSakura ? 'rgba(100,200,250,0.8)' : 'rgba(90,200,255,0.7)',
    divider: isSakura ? 'rgba(56,189,248,0.2)' : 'rgba(70,160,255,0.2)',
    sideEdge: isSakura
      ? 'linear-gradient(180deg, rgba(56,189,248,0.4), rgba(56,189,248,0.1), rgba(56,189,248,0.3))'
      : 'linear-gradient(180deg, rgba(60,180,255,0.4), rgba(60,180,255,0.1), rgba(60,180,255,0.3))',
    homeBtnBg: isSakura ? 'rgba(56,189,248,0.18)' : 'rgba(50,130,255,0.12)',
    homeBtnBorder: isSakura ? 'rgba(56,189,248,0.3)' : 'rgba(80,170,255,0.2)',
    homeBtnText: isSakura ? 'rgba(160,225,255,0.9)' : 'rgba(140,215,255,0.8)',
    btnBg: isSakura ? 'rgba(56,189,248,0.15)' : 'rgba(60,140,255,0.1)',
    btnBorder: isSakura ? 'rgba(56,189,248,0.3)' : 'rgba(60,140,255,0.2)',
    btnText: isSakura ? 'rgba(150,215,250,0.85)' : 'rgba(100,180,255,0.7)',
    cardBorder: isSakura ? 'rgba(56,189,248,0.22)' : 'rgba(80,160,255,0.25)',
    progressBg: isSakura ? 'rgba(56,189,248,0.15)' : 'rgba(60,160,255,0.12)',
    progressGrad: isSakura ? 'rgba(30,180,240,0.45)' : 'rgba(0,180,255,0.4)',
    dotIdle: isSakura ? 'rgba(56,189,248,0.45)' : 'rgba(80,160,255,0.4)',
    roomBorder: isSakura ? 'rgba(56,189,248,0.18)' : 'rgba(60,140,255,0.15)',
    speakerBorder: isSakura ? 'rgba(56,189,248,0.2)' : 'rgba(80,160,255,0.18)',
    speakerIcon: isSakura ? 'rgba(100,195,245,0.65)' : 'rgba(100,180,255,0.6)',
    headerBorder: isSakura ? 'rgba(56,189,248,0.28)' : 'rgba(80,160,255,0.25)',
    voiceOff: isSakura ? 'rgba(100,195,240,0.55)' : 'rgba(100,180,255,0.5)',
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: isSakura ? '#163252' : '#152e54' }} data-testid="spotify-player-page">
      <img
        src={isPlaying ? massBg : musicBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
        style={{ opacity: isPlaying ? 0.35 : 0.25, filter: isSakura ? "brightness(1.3) saturate(0.5) hue-rotate(200deg)" : "brightness(1.1) saturate(1.2) hue-rotate(200deg)" }}
      />

      <div className="absolute inset-0" style={{
        background: isSakura
          ? `
            radial-gradient(ellipse at 15% 30%, rgba(255,183,197,0.4) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 20%, rgba(56,189,248,0.45) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 70%, rgba(255,192,203,0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(56,189,248,0.4) 0%, transparent 45%),
            radial-gradient(ellipse at 30% 50%, rgba(100,200,255,0.25) 0%, transparent 50%),
            linear-gradient(180deg, rgba(25,60,100,0.12) 0%, rgba(20,48,80,0.15) 100%)
          `
          : `
            radial-gradient(ellipse at 20% 50%, rgba(50,130,240,0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 30%, rgba(70,150,255,0.25) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 80%, rgba(40,100,200,0.25) 0%, transparent 60%),
            linear-gradient(180deg, rgba(20,50,100,0.2) 0%, rgba(25,55,110,0.35) 100%)
          `,
      }} />

      {isSakura && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `
            radial-gradient(circle at 10% 15%, rgba(255,182,193,0.12) 0%, transparent 25%),
            radial-gradient(circle at 90% 75%, rgba(255,192,203,0.1) 0%, transparent 25%),
            radial-gradient(circle at 40% 90%, rgba(255,175,185,0.08) 0%, transparent 20%)
          `,
          zIndex: 0,
        }} />
      )}

      <HoloCircuitLines accent={profile.accent} sakura={isSakura} />
      {isSakura && <CherryBlossoms />}
      {isSakura && <JapaneseWaves accent={profile.accent} />}
      <HoloScanLine />

      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-lg text-xs font-medium text-white/95"
          style={{
            background: isSakura ? 'rgba(20,50,80,0.9)' : 'rgba(25,55,105,0.92)',
            border: `1px solid ${profile.accent}60`,
            backdropFilter: "blur(20px)",
            boxShadow: `0 0 30px ${profile.glow}, 0 0 60px rgba(0,0,0,0.3)`,
            animation: "fadeInUp 0.3s ease",
          }}
          data-testid="notification">
          <Zap className="inline h-3 w-3 mr-1.5" style={{ color: profile.accent }} />
          {notification}
        </div>
      )}

      {(() => {
        const h = new Date().getHours();
        if (isSakura) {
          const greeting = h < 12 ? "おはようございます" : h < 18 ? "こんにちは" : "こんばんは";
          return (
            <div className="absolute top-5 z-50 pointer-events-none text-right" style={{ right: '2%' }} data-testid="yasu-greeting">
              <p className="text-3xl font-bold tracking-wide" style={{
                color: 'rgba(200,230,255,0.85)',
                textShadow: '0 0 20px rgba(56,189,248,0.6), 0 0 40px rgba(255,183,197,0.3)',
                fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
              }}>
                {greeting}、やす
              </p>
            </div>
          );
        }
        const greeting = h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
        if (activeProfile === "bryn") {
          return (
            <div className="absolute top-5 z-50 pointer-events-none text-right" style={{ right: '2%' }} data-testid="bryn-greeting">
              <p className="text-3xl font-bold tracking-wide" style={{
                color: 'rgba(200,230,255,0.85)',
                textShadow: `0 0 20px ${profile.glow}, 0 0 40px rgba(80,160,255,0.3)`,
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: '0.04em',
              }}>
                {greeting}, Bryn
              </p>
            </div>
          );
        }
        if (activeProfile === "guest") {
          return (
            <div className="absolute top-5 z-50 pointer-events-none text-right" style={{ right: '2%' }} data-testid="guest-greeting">
              <p className="text-3xl font-bold tracking-wide" style={{
                color: 'rgba(200,230,255,0.85)',
                textShadow: `0 0 20px ${profile.glow}, 0 0 40px rgba(160,100,255,0.3)`,
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: '0.04em',
              }}>
                {greeting}
              </p>
            </div>
          );
        }
        return null;
      })()}

      <div className="relative z-10 flex-1 flex overflow-hidden" style={{
        transform: profileSpinning ? "perspective(1200px) rotateY(-90deg)" : "perspective(1200px) rotateY(0deg)",
        opacity: profileSpinning ? 0 : 1,
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease",
      }}>

        <div className="flex flex-col flex-shrink-0 relative" style={{ width: menuOpen ? 200 : 48, transition: "width 0.3s ease" }}>
          <div className="absolute inset-0" style={{
            background: isSakura ? 'rgba(20,50,80,0.75)' : 'rgba(22,48,90,0.8)',
            backdropFilter: "blur(30px)",
            borderRight: isSakura ? '1px solid rgba(56,189,248,0.22)' : '1px solid rgba(70,160,255,0.25)',
          }} />
          <div className="absolute top-0 right-0 bottom-0 w-[1px]" style={{
            background: tc.sideEdge,
          }} />

          <div className="relative z-10 flex flex-col h-full py-2">
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="w-full flex items-center justify-center py-2.5 mb-1 transition-colors"
              style={{ color: tc.menuToggle }}
              data-testid="menu-toggle">
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <div className="flex-1 flex flex-col gap-0.5 mt-2 px-1">
              {([
                { mode: "floor" as ViewMode, icon: <Home className="h-3.5 w-3.5" />, label: isSakura ? "間取り" : "Floor Plan" },
                { mode: "stations" as ViewMode, icon: <Radio className="h-3.5 w-3.5" />, label: isSakura ? "ステーション" : "Stations" },
                { mode: "rooms" as ViewMode, icon: <Speaker className="h-3.5 w-3.5" />, label: isSakura ? "部屋" : "Rooms" },
              ]).map(item => (
                <button key={item.mode}
                  onClick={() => switchView(item.mode)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all"
                  style={{
                    background: viewMode === item.mode ? `${profile.accent}18` : "transparent",
                    color: viewMode === item.mode ? profile.accent : tc.navIdle,
                    borderLeft: viewMode === item.mode ? `2px solid ${profile.accent}` : '2px solid transparent',
                  }}
                  data-testid={`nav-${item.mode}`}>
                  <div className="flex-shrink-0">{item.icon}</div>
                  {menuOpen && <span className="text-[12px] whitespace-nowrap font-medium">{item.label}</span>}
                </button>
              ))}

              <div className="my-2 mx-2 h-[1px]" style={{ background: tc.divider }} />

              <button onClick={() => setShowSearch(!showSearch)}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all"
                style={{ color: showSearch ? profile.accent : tc.navIdle }}
                data-testid="nav-search">
                <Search className="h-3.5 w-3.5 flex-shrink-0" />
                {menuOpen && <span className="text-[12px] whitespace-nowrap font-medium">Search</span>}
              </button>

              <div className="my-2 mx-2 h-[1px]" style={{ background: tc.divider }} />

              {flickDeviceGroups.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowFlickMenu(!showFlickMenu)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all ${showFlickMenu ? 'ring-1 ring-blue-400' : ''}`}
                    style={{ color: showFlickMenu ? profile.accent : tc.navIdle }}
                    data-testid="nav-flick-cast"
                    disabled={isFlicking}>
                    {isFlicking ? <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" /> : <Cast className="h-3.5 w-3.5 flex-shrink-0" />}
                    {menuOpen && <span className="text-[12px] whitespace-nowrap font-medium">{isSakura ? "転送" : "Cast"}</span>}
                  </button>
                  {showFlickMenu && (
                    <div className="absolute left-full top-0 ml-1 w-52 rounded-lg shadow-2xl overflow-hidden z-50"
                      style={{ background: isSakura ? 'rgba(20,50,80,0.95)' : 'rgba(10,25,50,0.95)', border: `1px solid ${profile.accent}30`, backdropFilter: 'blur(20px)' }}>
                      <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${profile.accent}20` }}>
                        <span className="text-[12px] font-semibold" style={{ color: profile.accent }}>{isSakura ? "転送先..." : "Cast to..."}</span>
                        <button onClick={() => setShowFlickMenu(false)} style={{ color: tc.navIdle }} data-testid="button-close-flick-menu"><X className="h-3 w-3" /></button>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {flickDeviceGroups.map((group) => (
                          <div key={group.room}>
                            <div className="px-2.5 py-1 flex items-center gap-1.5 sticky top-0" style={{ background: isSakura ? 'rgba(30,60,90,0.8)' : 'rgba(15,35,65,0.8)' }}>
                              <span className="text-[11px]">{group.icon}</span>
                              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(200,220,255,0.6)' }}>{group.room}</span>
                            </div>
                            {group.devices.filter(d => d.canDisplay).map((device) => (
                              <button key={device.id} data-testid={`button-flick-${device.id}`}
                                className="w-full px-2.5 py-1.5 pl-5 flex items-center gap-2 transition-colors text-left hover:brightness-125"
                                style={{ color: 'rgba(200,220,255,0.85)' }}
                                onClick={() => handleSpotifyFlick(device.id)} disabled={isFlicking}>
                                <Monitor className="h-3 w-3 flex-shrink-0" style={{ color: profile.accent }} />
                                <span className="text-[12px] truncate">{device.name}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleStopAll}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all hover:scale-105"
                style={{ color: 'rgba(255,100,100,0.7)' }}
                data-testid="nav-stop-all">
                <Square className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" />
                {menuOpen && <span className="text-[12px] whitespace-nowrap font-medium">{isSakura ? "全停止" : "Stop All"}</span>}
              </button>
            </div>

            <div className="mt-auto flex flex-col gap-0.5 px-1 pb-1">
              <button onClick={() => { window.location.href = "http://172.24.0.2:8123/lovelace/test-home"; }}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all hover:scale-105 mb-1"
                style={{
                  color: tc.homeBtnText,
                  background: tc.homeBtnBg,
                  border: `1px solid ${tc.homeBtnBorder}`,
                }}
                data-testid="back-to-dashboard">
                <Home className="h-4 w-4 flex-shrink-0" />
                {menuOpen && <span className="text-[12px] whitespace-nowrap font-medium">{isSakura ? "ホーム" : "Home"}</span>}
              </button>
              <div className="mx-2 mb-1 h-[1px]" style={{ background: tc.divider }} />
              {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
                <button key={k} onClick={() => switchProfile(k)}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all"
                  style={{
                    background: activeProfile === k ? `${PROFILES[k].accent}15` : "transparent",
                    boxShadow: activeProfile === k ? `0 0 20px ${PROFILES[k].glow}, inset 0 0 15px ${PROFILES[k].glow}` : "none",
                  }}
                  data-testid={`profile-${k}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                    style={{
                      background: activeProfile === k
                        ? `linear-gradient(135deg, ${PROFILES[k].accent}40, ${PROFILES[k].accent}20)`
                        : 'rgba(50,130,255,0.18)',
                      border: `1px solid ${activeProfile === k ? PROFILES[k].accent + '60' : 'rgba(80,170,255,0.25)'}`,
                      color: activeProfile === k ? PROFILES[k].accent : 'rgba(120,200,255,0.65)',
                      boxShadow: activeProfile === k ? `0 0 10px ${PROFILES[k].glow}` : 'none',
                    }}>
                    {PROFILES[k].label[0]}
                  </div>
                  {menuOpen && <span className="text-[12px] whitespace-nowrap font-medium"
                    style={{ color: activeProfile === k ? PROFILES[k].accent : 'rgba(120,200,255,0.65)' }}>
                    {PROFILES[k].label}
                  </span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-3 p-3 overflow-hidden">

          <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: 260 }}>
            <HoloPanel accent={profile.accent} glow={isPlaying} sakura={isSakura} className="p-3 flex flex-col items-center"
              onDrop={handlePlayerDrop}
              onDragOver={handlePlayerDragOver}
              onDragLeave={() => setPlayerDropHighlight(false)}
              style={playerDropHighlight ? { outline: `2px dashed ${profile.accent}`, outlineOffset: -2 } : undefined}>
              {isPlaying && nowPlaying?.albumArt ? (
                <div className="relative w-full flex flex-col items-center">
                  <div className="relative" style={{ width: 200, height: 200 }}>
                    <img src={nowPlaying.albumArt} alt={nowPlaying.album || "Album Art"}
                      className="w-full h-full rounded-lg object-cover"
                      style={{
                        border: `2px solid ${profile.accent}40`,
                        boxShadow: `0 0 30px ${profile.glow}, 0 0 60px ${profile.glow}, 0 4px 20px rgba(0,0,0,0.5)`,
                        animation: 'albumPulse 3s ease-in-out infinite',
                      }}
                      data-testid="album-art-large" />
                    <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
                      background: `linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4) 100%)`,
                    }} />
                    <div className="absolute -bottom-2 -right-2 w-12 h-12">
                      <HoloVinyl albumArt={nowPlaying.albumArt} playing={true} accent={profile.accent} size={48} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex items-center justify-center" style={{ minHeight: 180 }}>
                  <HoloVinyl albumArt={nowPlaying?.albumArt} playing={isPlaying} accent={profile.accent} size={220} />
                </div>
              )}

              <div className="text-center mt-2 px-2 min-w-0" style={{ width: '100%', maxWidth: '236px' }}>
                <p className="text-sm font-bold truncate" data-testid="track-name"
                  style={{ color: 'rgba(200,230,255,0.95)', textShadow: isPlaying ? `0 0 20px ${profile.glow}` : 'none' }}>
                  {ja(nowPlaying?.name) || (isSakura ? "再生なし" : "Nothing Playing")}
                </p>
                {isPlaying && nowPlaying?.artist && (() => {
                  const firstArtist = nowPlaying.artist.split(",")[0].trim();
                  const artistImg = artistImages[firstArtist];
                  return (
                    <div className="flex items-center justify-center gap-1.5 mt-1 min-w-0">
                      {artistImg && (
                        <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0"
                          style={{
                            border: `1px solid ${profile.accent}50`,
                            boxShadow: `0 0 8px ${profile.glow}`,
                            background: `url(${artistImg}) center/cover`,
                          }} />
                      )}
                      <p className="text-sm truncate font-medium min-w-0" data-testid="track-artist"
                        style={{ color: profile.accent }}>
                        {nowPlaying.artist}
                      </p>
                    </div>
                  );
                })()}
                {(!isPlaying || !nowPlaying?.artist) && (
                  <p className="text-sm truncate mt-0.5 font-medium" data-testid="track-artist-idle"
                    style={{ color: "rgba(130,200,255,0.7)" }}>
                    {nowPlaying?.artist || (isSakura ? "アーティストを選んでね" : "Select an artist or station")}
                  </p>
                )}
                {nowPlaying?.album && (
                  <p className="text-[11px] truncate mt-0.5" data-testid="track-album"
                    style={{ color: 'rgba(120,190,255,0.6)' }}>{ja(nowPlaying.album)}</p>
                )}
                {activeSpeakers.length > 0 && (
                  <div className="mt-2 w-full flex flex-wrap items-center justify-center gap-1" data-testid="active-speakers-list">
                    {activeSpeakers.map(spk => (
                      <div key={spk.entityId} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img src={echoSpeakerImg} alt="" className="rounded-sm" style={{ width: 12, height: 12 }} />
                        <span className="text-[9px] text-white font-medium">{spk.name}</span>
                        <button onClick={() => setActiveSpeakers(prev => prev.filter(s => s.entityId !== spk.entityId))}
                          className="ml-0.5 hover:scale-125 transition-transform" style={{ color: 'rgba(255,255,255,0.4)' }}
                          data-testid={`remove-speaker-${spk.name.toLowerCase().replace(/\s/g, "-")}`}>
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </HoloPanel>

            <HoloPanel accent={profile.accent} sakura={isSakura} className="flex-1 overflow-hidden p-3">
              <div className="text-[12px] uppercase tracking-[0.2em] font-bold mb-2 px-1 flex items-center gap-1.5"
                style={{ color: `${profile.accent}90` }}>
                <Wifi className="h-3 w-3" />
                {isSakura ? "お気に入り" : "Favorites"}
              </div>
              <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none", maxHeight: 'calc(100% - 24px)' }}>
                <div className="grid grid-cols-2 gap-1.5">
                  {profile.artists.map((artist, i) => {
                    const isSelected = selectedArtist?.name === artist.name;
                    return (
                    <div key={artist.name} draggable
                      onDragStart={handleDragStart("artist", artist)}
                      onDragEnd={() => setDragItem(null)}
                      onTouchStart={handleTouchStart("artist", artist)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={(e) => {
                        const td = touchDragRef.current;
                        if (td?.movedEnough) { handleTouchEnd(e); return; }
                        touchDragRef.current = null;
                      }}
                      onClick={() => {
                        if (selectedArtist?.name === artist.name) { setSelectedArtist(null); }
                        else { setSelectedArtist(artist); if (viewMode !== "floor") { switchView("floor"); } showNotif(isSakura ? `${artist.name} を選択 → 部屋をタップ` : `${artist.name} selected — tap a room`); }
                      }}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer transition-all group hover:scale-105"
                      style={{
                        background: isSelected
                          ? `${profile.accent}25`
                          : isSakura ? "rgba(30,65,100,0.5)" : "rgba(30,60,110,0.6)",
                        border: `1px solid ${isSelected ? profile.accent : tc.cardBorder}`,
                        boxShadow: isSelected ? `0 0 20px ${profile.glow}, inset 0 0 15px ${profile.glow}` : 'none',
                        animation: `fadeInUp 0.4s ease ${i * 60}ms both`,
                      }}
                      data-testid={`artist-card-${artist.name.toLowerCase().replace(/\s/g, "-")}`}>
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 transition-all"
                        style={{
                          border: `2px solid ${isSelected ? profile.accent : `${profile.accent}50`}`,
                          boxShadow: isSelected ? `0 0 25px ${profile.accent}` : `0 0 18px ${profile.glow}`,
                          background: artistImages[artist.name]
                            ? `url(${artistImages[artist.name]}) center/cover`
                            : `linear-gradient(135deg, ${profile.accent}40, rgba(30,60,115,0.7))`,
                        }}>
                        {!artistImages[artist.name] && <div className="w-full h-full flex items-center justify-center"><Music2 className="h-4 w-4" style={{ color: `${profile.accent}60` }} /></div>}
                      </div>
                      <span className="text-[11px] truncate w-full text-center font-medium transition-colors"
                        style={{ color: isSelected ? profile.accent : tc.textBright }}>{artist.name}</span>
                    </div>
                    );
                  })}
                </div>

                {recommendations.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${profile.accent}15` }}>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2 px-1 flex items-center gap-1.5"
                      style={{ color: `${profile.accent}60` }}>
                      <Star className="h-3 w-3" />
                      {isSakura ? "おすすめ" : "You Might Like"}
                    </div>
                    <div className="relative overflow-hidden rounded-lg" style={{ background: 'rgba(20,45,85,0.5)', border: `1px solid ${profile.accent}18` }}>
                      {recommendations.map((reco, i) => (
                        <div key={reco.id}
                          className="flex items-center gap-2 p-2 cursor-pointer transition-all"
                          style={{
                            display: i === recoIndex ? 'flex' : 'none',
                            animation: i === recoIndex ? 'fadeInUp 0.5s ease' : 'none',
                          }}
                          onClick={() => {
                            doAction("play-context", "POST", { contextUri: reco.uri });
                            announceTrack(reco.name, reco.name);
                            showNotif(`Playing ${reco.name}`);
                          }}
                          data-testid={`reco-artist-${i}`}>
                          {reco.image ? (
                            <img src={reco.image} alt={reco.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                              style={{ border: `1.5px solid ${profile.accent}30`, boxShadow: `0 0 12px ${profile.glow}` }} />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${profile.accent}20` }}>
                              <Music2 className="h-4 w-4" style={{ color: profile.accent }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold truncate" style={{ color: 'rgba(180,220,255,0.9)' }}>{reco.name}</p>
                            <p className="text-[9px]" style={{ color: `${profile.accent}50` }}>
                              {isSakura ? "タップして再生" : "Tap to play"}
                            </p>
                          </div>
                          <Play className="h-3 w-3 flex-shrink-0" style={{ color: `${profile.accent}60` }} />
                        </div>
                      ))}
                      {recommendations.length > 1 && (
                        <div className="flex justify-center gap-1 pb-1.5">
                          {recommendations.map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full transition-all"
                              style={{ background: i === recoIndex ? profile.accent : `${profile.accent}25` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </HoloPanel>
          </div>

          <div className="flex-1 relative rounded-xl overflow-hidden" style={{
            border: `1px solid ${dragItem ? `${profile.accent}50` : (isSakura ? 'rgba(56,189,248,0.15)' : 'rgba(50,140,255,0.15)')}`,
            transition: "border-color 0.3s ease, box-shadow 0.3s ease",
            boxShadow: dragItem
              ? `0 0 40px ${profile.glow}, inset 0 0 30px ${profile.glow}`
              : `inset 0 1px 0 ${isSakura ? 'rgba(56,189,248,0.12)' : 'rgba(50,140,255,0.1)'}`,
            background: isSakura ? "rgba(14,38,62,0.55)" : "rgba(25,50,90,0.55)",
            backdropFilter: "blur(20px)",
            perspective: '1200px',
          }}>
            <div className="absolute inset-0" style={{
              transform: viewSpinning ? 'rotateY(90deg)' : 'rotateY(0deg)',
              opacity: viewSpinning ? 0 : 1,
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
              transformStyle: 'preserve-3d',
            }}>
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
              background: isSakura ? 'linear-gradient(90deg, transparent, rgba(56,189,248,0.15), transparent)' : 'linear-gradient(90deg, transparent, rgba(0,180,255,0.15), transparent)',
            }} />

            {showSearch && (
              <div className="absolute inset-0 z-20 p-4 overflow-y-auto" style={{ background: isSakura ? 'rgba(18,45,72,0.92)' : 'rgba(22,48,88,0.94)', backdropFilter: 'blur(20px)', scrollbarWidth: 'none' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{
                    background: isSakura ? 'rgba(30,65,100,0.5)' : 'rgba(28,55,100,0.6)', border: `1px solid ${tc.cardBorder}`,
                  }}>
                    <Search className="h-3.5 w-3.5" style={{ color: tc.voiceOff }} />
                    <input
                      type="text" value={searchQuery} placeholder="Search songs, artists..."
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        if (searchTimeout.current) clearTimeout(searchTimeout.current);
                        searchTimeout.current = setTimeout(() => doSearch(e.target.value), 500);
                      }}
                      className="flex-1 bg-transparent text-xs outline-none placeholder:text-blue-400/40"
                      style={{ color: 'rgba(200,230,255,0.8)' }}
                      data-testid="search-input" autoFocus
                    />
                  </div>
                  <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
                    className="p-2 rounded-lg transition-colors" style={{ color: tc.voiceOff }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {searching && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: profile.accent }} /></div>}
                <div className="grid grid-cols-2 gap-2">
                  {searchResults.map((r: any, i: number) => (
                    <button key={i} onClick={() => {
                      if (r.uri) {
                        doAction("play-context", "POST", { contextUri: r.uri });
                        announceTrack(r.name, r.artist || r.name);
                        showNotif(`Playing ${r.name}`);
                        setShowSearch(false);
                      }
                    }}
                      className="flex items-center gap-2 p-2.5 rounded-lg transition-all text-left group"
                      style={{ background: isSakura ? 'rgba(30,65,100,0.45)' : 'rgba(28,55,100,0.55)', border: `1px solid ${tc.cardBorder}` }}
                      data-testid={`search-result-${i}`}>
                      {r.image ? (
                        <img src={r.image} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                          style={{ border: '1px solid rgba(0,180,255,0.15)' }} />
                      ) : (
                        <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: `${profile.accent}18`, border: '1px solid rgba(60,150,255,0.15)' }}>
                          <Music2 className="h-3.5 w-3.5" style={{ color: `${profile.accent}60` }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: 'rgba(200,230,255,0.8)' }}>{r.name}</p>
                        <p className="text-[11px] truncate" style={{ color: 'rgba(80,170,255,0.5)' }}>{r.artist || r.type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewMode === "floor" && (
              <>
                <img src={floorplanImg} alt="Apartment floor plan" className="absolute inset-0 w-full h-full object-contain"
                  style={{ filter: "brightness(0.9) contrast(1.1) saturate(0.7) hue-rotate(190deg)", opacity: 0.9 }} />
                <div className="absolute inset-0" onClick={() => setFloorSpeakerPopup(null)} style={{
                  background: `radial-gradient(ellipse at center, transparent 30%, rgba(3,8,20,0.6) 100%)`,
                }} />
                {ROOM_HOTSPOTS.map(spot => {
                  const isActive = activeRooms.has(spot.room);
                  const isDrop = dropTarget === spot.room;
                  const roomData = rooms.find(r => r.room === spot.room);
                  const speakerCount = roomData?.speakers?.length || 0;
                  return (
                    <div key={spot.room}
                      data-room-hotspot={spot.room}
                      draggable onDragStart={handleDragStart("room", spot)}
                      onDrop={handleRoomDrop(spot.room)}
                      onDragOver={handleDragOver(spot.room)}
                      onDragLeave={() => setDropTarget(null)}
                      onTouchStart={handleTouchStart("room", spot)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={(e) => {
                        const td = touchDragRef.current;
                        if (td?.movedEnough) { handleTouchEnd(e); return; }
                        touchDragRef.current = null;
                      }}
                      onClick={() => {
                        if (selectedArtist) {
                          playOnRoom(spot.room, selectedArtist);
                          setSelectedArtist(null);
                        }
                      }}
                      className="absolute cursor-pointer transition-all"
                      style={{
                        left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%`,
                        background: isActive
                          ? `${profile.accent}12`
                          : (isDrop || selectedArtist)
                            ? `${profile.accent}10`
                            : 'transparent',
                        boxShadow: isActive
                          ? `0 0 35px ${profile.glow}, inset 0 0 20px ${profile.glow}`
                          : (isDrop || selectedArtist)
                            ? `0 0 25px ${profile.glow}`
                            : "none",
                        border: selectedArtist && !isActive ? `1px dashed ${profile.accent}50` : 'none',
                        animation: selectedArtist && !isActive ? 'holoPulse 2s ease-in-out infinite' : 'none',
                      }}
                      data-testid={`room-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                      {!spot.hideLabel && <div className="absolute inset-0 flex flex-col items-center justify-end gap-0.5" style={{ zIndex: 2, transform: `translate(${spot.labelOffsetX || 0}px, ${spot.labelOffsetY || 0}px)` }}>
                        <RoomIcon icon={spot.icon} size={16} color={isActive ? profile.accent : 'rgba(255,255,255,0.9)'} />
                        <span className="text-[7px] font-bold uppercase tracking-wider text-center leading-tight px-1"
                          style={{
                            color: isActive ? profile.accent : 'rgba(255,255,255,0.95)',
                            textShadow: isActive ? `0 0 10px ${profile.glow}` : '0 1px 4px rgba(0,0,0,0.7)',
                          }}>
                          {isSakura ? (ROOM_JP[spot.room] || spot.room) : spot.room}
                        </span>
                        {speakerCount > 0 && (
                          <div className="relative">
                            <button className="flex items-center gap-1 mt-0.5 px-1 py-0.5 rounded-lg cursor-pointer transition-all hover:scale-110"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFloorSpeakerPopup(floorSpeakerPopup === spot.room ? null : spot.room); }}
                              style={{
                                background: isActive ? `${profile.accent}20` : (isSakura ? 'rgba(30,65,100,0.5)' : 'rgba(25,50,90,0.6)'),
                                border: `1px solid ${isActive ? `${profile.accent}40` : 'rgba(255,255,255,0.15)'}`,
                              }}
                              data-testid={`floor-speakers-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                              <img src={echoSpeakerImg} alt="Speaker" className="rounded-md object-cover"
                                style={{
                                  width: 18, height: 18,
                                  filter: isActive ? `drop-shadow(0 0 4px ${profile.accent}) brightness(1.1)` : 'none',
                                }} />
                            </button>
                            {floorSpeakerPopup === spot.room && (
                              <div className="absolute w-48 rounded-lg shadow-2xl overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  zIndex: 9999,
                                  ...(spot.x < 30
                                    ? { bottom: '100%', left: '0', marginBottom: 4 }
                                    : { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4 }),
                                  background: isSakura ? 'rgba(20,50,80,0.95)' : 'rgba(10,25,50,0.95)',
                                  border: `1px solid ${profile.accent}30`,
                                  backdropFilter: 'blur(20px)',
                                }}>
                                <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${profile.accent}20` }}>
                                  <span className="text-[11px] font-semibold" style={{ color: profile.accent }}>
                                    {isSakura ? (ROOM_JP[spot.room] || spot.room) : spot.room}
                                  </span>
                                  <button onClick={() => setFloorSpeakerPopup(null)} style={{ color: 'rgba(255,255,255,0.5)' }}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="px-2 py-1.5 flex flex-col gap-1">
                                  {(rooms.find(r => r.room === spot.room)?.speakers || []).filter(spk => spk.type !== "group").map(spk => {
                                    const isEcho = spk.type === "echo" || spk.type === "echo_show";
                                    const isSpeakerActive = isActive;
                                    return (
                                      <button key={spk.entityId}
                                        draggable
                                        onDragStart={handleDragStart("speaker", { ...spk, room: spot.room })}
                                        onDragEnd={() => setDragItem(null)}
                                        onClick={() => {
                                          if (selectedArtist) {
                                            playOnRoom(spot.room, selectedArtist);
                                            setFloorSpeakerPopup(null);
                                          } else if (isPlaying && nowPlaying) {
                                            const artistData: ProfileArtist = {
                                              name: nowPlaying.artist || "",
                                              uri: "",
                                              searchQuery: nowPlaying.artist || "",
                                            };
                                            playOnRoom(spot.room, artistData);
                                            setFloorSpeakerPopup(null);
                                          } else {
                                            showNotif(isSakura ? "まず再生してください" : "Play something first");
                                          }
                                        }}
                                        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md transition-all hover:scale-[1.02] cursor-grab active:cursor-grabbing"
                                        style={{
                                          background: isSpeakerActive ? `${profile.accent}25` : 'rgba(100,140,180,0.12)',
                                          border: `1px solid ${isSpeakerActive ? `${profile.accent}50` : 'rgba(100,140,180,0.15)'}`,
                                        }}
                                        data-testid={`floor-play-${spk.name.toLowerCase().replace(/\s/g, "-")}`}>
                                        <img src={echoSpeakerImg} alt="Echo" className="rounded-md object-cover flex-shrink-0"
                                          style={{
                                            width: 22, height: 22,
                                            filter: isSpeakerActive ? `drop-shadow(0 0 3px ${profile.accent}) brightness(1.1)` : 'brightness(0.6) saturate(0.3)',
                                            opacity: isSpeakerActive ? 1 : 0.5,
                                          }} />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-[11px] font-medium block truncate"
                                            style={{ color: isSpeakerActive ? 'rgba(200,225,255,0.95)' : 'rgba(140,170,200,0.5)' }}>{spk.name}</span>
                                          <span className="text-[9px]"
                                            style={{ color: isSpeakerActive ? `${profile.accent}90` : 'rgba(100,140,180,0.35)' }}>{isEcho ? "Echo" : spk.type}</span>
                                        </div>
                                        {isSpeakerActive
                                          ? <span className="text-[9px]" style={{ color: profile.accent }}>♫</span>
                                          : <span className="text-[9px]" style={{ color: 'rgba(140,170,200,0.4)' }}>▶</span>
                                        }
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {isActive && (
                          <>
                            <div className="flex gap-0.5 mt-0.5">
                              {[...Array(3)].map((_, i) => (
                                <div key={i} className="w-0.5 rounded-full" style={{
                                  height: 4 + Math.random() * 6,
                                  background: profile.accent,
                                  boxShadow: `0 0 4px ${profile.accent}`,
                                  animation: `eqBounce ${0.3 + i * 0.15}s ease-in-out infinite alternate`,
                                }} />
                              ))}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); ungroupRoom(spot.room); }}
                              className="mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all hover:scale-110"
                              style={{
                                background: 'rgba(255,60,60,0.25)',
                                border: '1px solid rgba(255,60,60,0.35)',
                                color: 'rgba(255,120,120,0.9)',
                                textShadow: '0 0 4px rgba(255,60,60,0.3)',
                              }}
                              data-testid={`floorplan-ungroup-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                              {isSakura ? "✕ 解除" : "✕ Ungroup"}
                            </button>
                          </>
                        )}
                      </div>}
                      {(isActive || activeRooms.has("Everywhere")) && spot.room !== "Balcony" && (
                        <div className="absolute inset-0 flex items-end justify-center"
                          style={{ zIndex: 4, transform: `translate(${spot.volumeOffsetX || 0}px, ${spot.volumeOffsetY || 0}px)`, pointerEvents: 'none' }}
                          data-testid={`volume-knob-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                          <div style={{ pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
                            <VolumeKnob value={roomVolumes[spot.room] ?? 30} onChange={(v) => setRoomVolume(spot.room, v)} size={isActive ? 50 : 44} accent={isActive ? profile.accent : `${profile.accent}aa`} glow={profile.glow} roomName={spot.room} />
                          </div>
                        </div>
                      )}
                      {isDrop && (
                        <div className="absolute inset-0 pointer-events-none" style={{
                          border: `2px dashed ${profile.accent}70`,
                          animation: 'holoPulse 1s ease-in-out infinite',
                        }} />
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {viewMode === "stations" && (
              <div className="absolute inset-0 p-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="text-[12px] uppercase tracking-[0.15em] font-bold mb-3 flex items-center gap-1.5"
                  style={{ color: `${profile.accent}90` }}>
                  <Radio className="h-3.5 w-3.5" /> {isSakura ? "ステーション＆ショートカット" : "Stations & Shortcuts"}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STATION_SHORTCUTS.map((station, i) => {
                    const stImg = artistImages[station.name] || station.image;
                    return (
                    <button key={station.name}
                      onClick={() => playStation(station)}
                      className="flex items-center gap-2.5 p-3 rounded-lg transition-all group hover:scale-[1.02]"
                      style={{
                        background: isSakura ? "rgba(30,65,100,0.5)" : "rgba(28,55,100,0.6)",
                        border: `1px solid ${tc.cardBorder}`,
                        animation: `fadeInUp 0.3s ease ${i * 40}ms both`,
                      }}
                      data-testid={`station-${station.name.toLowerCase().replace(/\s/g, "-")}`}>
                      {stImg ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                          style={{
                            border: `1.5px solid ${profile.accent}50`,
                            boxShadow: `0 0 10px ${profile.glow}`,
                            background: `url(${stImg}) center/cover`,
                          }} />
                      ) : (
                        <span className="text-lg flex-shrink-0" style={{ filter: `drop-shadow(0 0 4px ${tc.dotIdle})` }}>{station.icon}</span>
                      )}
                      <span className="text-[13px] font-medium text-left truncate"
                        style={{ color: tc.navIdle }}>{station.name}</span>
                    </button>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === "rooms" && (
              <div className="absolute inset-0 p-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="text-[12px] uppercase tracking-[0.15em] font-bold mb-3 flex items-center gap-1.5"
                  style={{ color: `${profile.accent}90` }}>
                  <Speaker className="h-3.5 w-3.5" /> {isSakura ? "スピーカー部屋" : "Speaker Rooms"}
                </div>
                <div className="flex flex-col gap-2">
                  {ROOM_HOTSPOTS.map((spot, i) => {
                    const isActive = activeRooms.has(spot.room);
                    const isExpanded = expandedRoom === spot.room;
                    const roomData = rooms.find(r => r.room === spot.room);
                    const speakerList = roomData?.speakers || [];
                    return (
                      <div key={spot.room} className="rounded-lg transition-all overflow-hidden"
                        style={{
                          background: isActive ? `${profile.accent}15` : (isSakura ? "rgba(30,65,100,0.5)" : "rgba(28,55,100,0.6)"),
                          border: `1px solid ${isActive ? `${profile.accent}40` : tc.cardBorder}`,
                          boxShadow: isActive ? `0 0 20px ${profile.glow}, inset 0 0 15px ${profile.glow}` : "none",
                          animation: `fadeInUp 0.3s ease ${i * 40}ms both`,
                        }}
                        data-testid={`room-btn-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                        <button className="flex items-center gap-3 w-full text-left p-3"
                          onClick={() => setExpandedRoom(isExpanded ? null : spot.room)}>
                          <RoomIcon icon={spot.icon} size={20} color={isActive ? profile.accent : tc.navIdle} />
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-medium block"
                              style={{ color: isActive ? profile.accent : 'rgba(255,255,255,0.95)' }}>{isSakura ? (ROOM_JP[spot.room] || spot.room) : spot.room}</span>
                            <span className="text-[11px]" style={{ color: tc.textSoft }}>
                              {speakerList.length} {isSakura ? "台のスピーカー" : (speakerList.length === 1 ? "speaker" : "speakers")}
                            </span>
                          </div>
                          {isActive && (
                            <div className="flex gap-0.5 mr-2">
                              {[...Array(3)].map((_, j) => (
                                <div key={j} className="w-0.5 rounded-full" style={{
                                  height: 6 + Math.random() * 8,
                                  background: profile.accent,
                                  boxShadow: `0 0 4px ${profile.accent}`,
                                  animation: `eqBounce ${0.3 + j * 0.12}s ease-in-out infinite alternate`,
                                }} />
                              ))}
                            </div>
                          )}
                          <ChevronDown className="h-4 w-4 transition-transform flex-shrink-0" style={{
                            color: tc.dotIdle,
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }} />
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 flex flex-col gap-1.5" style={{
                            borderTop: `1px solid ${isActive ? `${profile.accent}20` : (isSakura ? 'rgba(56,189,248,0.08)' : 'rgba(40,120,255,0.08)')}`,
                          }}>
                            <div className="flex items-center justify-between pt-2 mb-1">
                              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: `${profile.accent}70` }}>
                                {isSakura ? "デバイス" : "Devices"}
                              </span>
                              <div className="flex gap-1.5">
                                <button onClick={() => {
                                  if (isPlaying && nowPlaying) {
                                    playOnRoom(spot.room, { name: nowPlaying.artist || "", uri: "", searchQuery: nowPlaying.artist || "" });
                                  } else { showNotif(isSakura ? "まず再生してください" : "Start playing something first"); }
                                }}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium transition-all hover:scale-105"
                                  style={{ background: `${profile.accent}20`, border: `1px solid ${profile.accent}30`, color: profile.accent }}
                                  data-testid={`play-room-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                                  {isSakura ? "▶ 全て再生" : "▶ Play All"}
                                </button>
                                {isActive && (
                                  <button onClick={() => ungroupRoom(spot.room)}
                                    className="px-2 py-0.5 rounded text-[10px] font-medium transition-all hover:scale-105"
                                    style={{ background: 'rgba(255,60,60,0.15)', border: '1px solid rgba(255,60,60,0.25)', color: 'rgba(255,120,120,0.8)' }}
                                    data-testid={`ungroup-${spot.room.toLowerCase().replace(/\s/g, "-")}`}>
                                    {isSakura ? "解除" : "Ungroup"}
                                  </button>
                                )}
                              </div>
                            </div>
                            {speakerList.map(spk => {
                              const isSpkExpanded = expandedSpeaker === spk.entityId;
                              const isEcho = spk.type === "echo" || spk.type === "echo_show";
                              return (
                                <div key={spk.entityId} className="rounded-lg overflow-hidden"
                                  style={{
                                    background: isSakura ? 'rgba(30,65,100,0.5)' : 'rgba(22,45,85,0.6)',
                                    border: `1px solid ${tc.speakerBorder}`,
                                  }}>
                                  <button className="flex items-center gap-2 w-full text-left px-2.5 py-2"
                                    onClick={() => setExpandedSpeaker(isSpkExpanded ? null : spk.entityId)}>
                                    <Speaker className="h-4 w-4 flex-shrink-0" style={{ color: isEcho ? profile.accent : tc.speakerIcon }} />
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[12px] font-medium block truncate" style={{ color: 'rgba(200,225,255,0.9)' }}>{spk.name}</span>
                                      <span className="text-[10px]" style={{ color: tc.textSoft }}>
                                        {isEcho ? "Echo" : spk.type} • {isSakura ? (ROOM_JP[spk.room] || spk.room) : spk.room}
                                      </span>
                                    </div>
                                    <ChevronDown className="h-3 w-3 transition-transform flex-shrink-0" style={{
                                      color: tc.dotIdle,
                                      transform: isSpkExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    }} />
                                  </button>
                                  {isSpkExpanded && (
                                    <div className="px-2.5 pb-2 flex flex-wrap gap-1.5" style={{
                                      borderTop: `1px solid ${isSakura ? 'rgba(56,189,248,0.08)' : 'rgba(40,120,255,0.06)'}`,
                                      paddingTop: '6px',
                                    }}>
                                      <button onClick={() => {
                                        if (isPlaying && nowPlaying) {
                                          fetch(`/api/spotify/play-on-speaker`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ entityId: spk.entityId, artistName: nowPlaying.artist, deviceType: spk.type }),
                                          }).then(() => showNotif(`${isSakura ? "再生中" : "Playing on"} ${spk.name}`));
                                        } else { showNotif(isSakura ? "まず再生してください" : "Play something first"); }
                                      }}
                                        className="px-2 py-1 rounded text-[10px] font-medium transition-all hover:scale-105"
                                        style={{ background: `${profile.accent}15`, border: `1px solid ${profile.accent}25`, color: profile.accent }}
                                        data-testid={`play-speaker-${spk.name.toLowerCase().replace(/\s/g, "-")}`}>
                                        ▶ {isSakura ? "再生" : "Play"}
                                      </button>
                                      <button onClick={() => {
                                        fetch(`/api/spotify/play-on-speaker`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ entityId: spk.entityId, command: "pause", deviceType: spk.type }),
                                        }).then(() => showNotif(`${isSakura ? "一時停止" : "Paused"} ${spk.name}`));
                                      }}
                                        className="px-2 py-1 rounded text-[10px] font-medium transition-all hover:scale-105"
                                        style={{ background: 'rgba(255,180,0,0.12)', border: '1px solid rgba(255,180,0,0.2)', color: 'rgba(255,200,60,0.8)' }}>
                                        ⏸ {isSakura ? "停止" : "Pause"}
                                      </button>
                                      <button onClick={() => {
                                        fetch(`/api/spotify/volume`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ entityId: spk.entityId, volume: 30 }),
                                        }).then(() => showNotif(`${spk.name} → 30%`));
                                      }}
                                        className="px-2 py-1 rounded text-[10px] font-medium transition-all hover:scale-105"
                                        style={{ background: tc.btnBg, border: `1px solid ${tc.btnBorder}`, color: tc.btnText }}>
                                        🔉 30%
                                      </button>
                                      <button onClick={() => {
                                        fetch(`/api/spotify/volume`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ entityId: spk.entityId, volume: 60 }),
                                        }).then(() => showNotif(`${spk.name} → 60%`));
                                      }}
                                        className="px-2 py-1 rounded text-[10px] font-medium transition-all hover:scale-105"
                                        style={{ background: tc.btnBg, border: `1px solid ${tc.btnBorder}`, color: tc.btnText }}>
                                        🔊 60%
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {speakerList.length === 0 && (
                              <span className="text-[11px] py-2 text-center" style={{ color: tc.textSoft }}>
                                {isSakura ? "スピーカーが見つかりません" : "No speakers found"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10" style={{
        background: isSakura ? 'rgba(20,50,80,0.8)' : 'rgba(22,48,88,0.85)',
        backdropFilter: 'blur(30px)',
        borderTop: isSakura ? '1px solid rgba(56,189,248,0.22)' : '1px solid rgba(70,160,255,0.25)',
      }}>
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
          background: isSakura ? 'linear-gradient(90deg, transparent, rgba(56,189,248,0.35), transparent)' : 'linear-gradient(90deg, transparent, rgba(60,160,255,0.35), transparent)',
        }} />

        <div className="px-6 pt-2 pb-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[12px] tabular-nums w-10 text-right" style={{ color: tc.textMuted }}>{formatMs(localProgress)}</span>
            <div className="flex-1 h-[3px] rounded-full overflow-hidden cursor-pointer group relative"
              style={{ background: tc.progressBg }}
              onClick={e => {
                if (!nowPlaying?.duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                doAction("seek", "POST", { positionMs: Math.round(pct * nowPlaying.duration) });
              }}
              data-testid="progress-bar">
              <div className="h-full rounded-full transition-all relative" style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${tc.progressGrad}, ${profile.accent})`,
                boxShadow: `0 0 10px ${profile.glow}, 0 0 20px ${profile.glow}`,
              }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: profile.accent, boxShadow: `0 0 8px ${profile.accent}, 0 0 16px ${profile.glow}` }} />
              </div>
            </div>
            <span className="text-[12px] tabular-nums w-10" style={{ color: tc.textMuted }}>{formatMs(nowPlaying?.duration || 0)}</span>
          </div>

          <div className="flex items-center justify-center gap-6 pb-1">
            <button onClick={() => doAction("shuffle", "POST")} className="transition-all hover:scale-110"
              style={{ color: shuffleOn ? profile.accent : "rgba(120,200,255,0.6)", filter: shuffleOn ? `drop-shadow(0 0 6px ${profile.glow})` : 'none' }}
              data-testid="btn-shuffle">
              <Shuffle className="h-4 w-4" />
            </button>
            <button onClick={() => doAction("previous")} className="hover:scale-110 transition-all"
              style={{ color: tc.navIdle }} data-testid="btn-prev">
              <SkipBack className="h-5 w-5" />
            </button>
            <button onClick={() => doAction(isPlaying ? "pause" : "play", "PUT")}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${profile.accent}cc, ${profile.accent})`,
                boxShadow: `0 0 30px ${profile.glow}, 0 0 60px ${profile.glow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
                border: `1px solid ${profile.accent}60`,
              }}
              data-testid="btn-play-pause">
              {actionPending ? <Loader2 className="h-5 w-5 text-white animate-spin" /> :
                isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
            </button>
            <button onClick={() => doAction("next")} className="hover:scale-110 transition-all"
              style={{ color: tc.navIdle }} data-testid="btn-next">
              <SkipForward className="h-5 w-5" />
            </button>
            <button onClick={() => doAction("repeat", "POST")} className="transition-all hover:scale-110 relative"
              style={{ color: repeatMode !== "off" ? profile.accent : tc.navIdle, filter: repeatMode !== "off" ? `drop-shadow(0 0 6px ${profile.glow})` : 'none' }}
              data-testid="btn-repeat">
              <Repeat className="h-4 w-4" />
              {repeatMode === "track" && <span className="absolute -top-1 -right-1 text-[6px] font-bold" style={{ color: profile.accent }}>1</span>}
            </button>

            <div className="ml-8 flex items-center gap-2">
              <button onClick={() => doAction("volume", "POST", { volume: volume > 0 ? 0 : 30 })}
                className="transition-colors" style={{ color: tc.speakerIcon }} data-testid="btn-mute">
                {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input type="range" min={0} max={100} value={volume}
                onChange={e => { setVolume(+e.target.value); doAction("volume", "POST", { volume: +e.target.value }); }}
                className="w-24 holo-range" style={{ height: 3 }}
                data-testid="volume-slider" />
            </div>

            <button onClick={toggleVoiceConfirm}
              className="ml-4 flex items-center gap-1 px-2 py-1 rounded-md transition-all hover:scale-105"
              style={{
                background: voiceConfirm ? `${profile.accent}20` : (isSakura ? 'rgba(56,189,248,0.1)' : 'rgba(40,120,255,0.08)'),
                border: `1px solid ${voiceConfirm ? profile.accent + '50' : (isSakura ? 'rgba(56,189,248,0.2)' : 'rgba(60,150,255,0.18)')}`,
                color: voiceConfirm ? profile.accent : tc.voiceOff,
                boxShadow: voiceConfirm ? `0 0 10px ${profile.glow}` : 'none',
              }}
              data-testid="btn-voice-confirm"
              title={isSakura ? "音声確認" : "Voice confirmations"}>
              <Volume1 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">{isSakura ? "音声" : "Voice"}</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes eqBounce { from { height: 3px; } to { height: 12px; } }
        @keyframes albumPulse { 0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.2), 0 4px 15px rgba(0,0,0,0.4); } 50% { box-shadow: 0 0 40px rgba(59,130,246,0.35), 0 4px 20px rgba(0,0,0,0.5); } }
        @keyframes holoScan {
          0% { top: -2px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes holoPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        .holo-range {
          -webkit-appearance: none;
          background: ${isSakura ? 'rgba(56,189,248,0.15)' : 'rgba(60,160,255,0.12)'};
          border-radius: 4px;
          outline: none;
        }
        .holo-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${profile.accent};
          cursor: pointer;
          box-shadow: 0 0 8px ${profile.glow}, 0 0 16px ${profile.glow};
        }
        .holo-range::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${profile.accent};
          cursor: pointer;
          box-shadow: 0 0 8px ${profile.glow}, 0 0 16px ${profile.glow};
          border: none;
        }
      `}</style>
    </div>
  );
}
