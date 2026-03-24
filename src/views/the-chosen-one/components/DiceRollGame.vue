<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps<{
  names: string[]
}>()

const emit = defineEmits<{
  winner: [name: string]
}>()

// ── Geometry ───────────────────────────────────────────
// The die is an N-gon prism where N = names.length.
// It rotates around its vertical (Y) axis — each lateral face shows one name.
// inradius = apothem = distance from the axis to the midpoint of each face.

const PANEL_HEIGHT = 130 // px — height of every face

// Target a comfortable face width (~180 px) and derive a fitting inradius,
// then clamp so the die always fits on screen.
const TARGET_PANEL_W = 180
const MIN_RADIUS = 65
const MAX_RADIUS = 260

const inradius = computed<number>(() => {
  const n = Math.max(3, props.names.length)
  const r = TARGET_PANEL_W / (2 * Math.tan(Math.PI / n))
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r))
})

// Actual face width derived from the inradius (polygon apothem formula)
const panelWidth = computed<number>(() => {
  const n = Math.max(3, props.names.length)
  return 2 * inradius.value * Math.tan(Math.PI / n)
})

// Rotation angle between consecutive faces
const anglePerFace = computed<number>(() => 360 / Math.max(2, props.names.length))

// CSS perspective — more than twice the inradius for natural depth perception
const perspectivePx = computed<number>(() => inradius.value * 2.6 + 220)

// Font size scales down gracefully when many names → narrow faces
const faceFontSize = computed<number>(() => {
  const n = props.names.length
  if (n <= 4) return 18
  if (n <= 8) return 15
  if (n <= 14) return 12
  if (n <= 25) return 10
  return 8
})

// ── State ──────────────────────────────────────────────
// drumRotX / Z provide the tumbling wobble; drumRotY is the main spin axis.
const drumRotX = ref(-10) // static tilt so top edge is visible at rest
const drumRotY = ref(0)
const drumRotZ = ref(0)
const isRolling = ref(false)
const winnerIndex = ref<number | null>(null)

let animId = 0

// ── Easing ─────────────────────────────────────────────
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

// ── Roll ──────────────────────────────────────────────
function spin(): void {
  if (isRolling.value || props.names.length < 2) return

  isRolling.value = true
  winnerIndex.value = null

  const n = props.names.length
  const wIdx = Math.floor(Math.random() * n)
  const winnerName = props.names[wIdx] ?? ''

  // ── Y axis: primary face selector ──
  // Face i faces the camera when drumRotY ≡ -(i × anglePerFace).
  const targetFaceAngle = -(wIdx * anglePerFace.value)
  const fullRotY = 6 + Math.floor(Math.random() * 5) // 6–10 full spins
  const offsetY = (((targetFaceAngle - drumRotY.value) % 360) + 360) % 360
  const targetRotY = drumRotY.value + offsetY - fullRotY * 360

  // ── X axis: tumble forward / back — lands back at rest tilt −10° ──
  // Always starts from −10 (canonical snap), so we just add N full rotations.
  const fullRotX = 3 + Math.floor(Math.random() * 4) // 3–6 full spins
  const dirX = Math.random() < 0.5 ? 1 : -1
  const targetRotX = -10 + dirX * fullRotX * 360

  // ── Z axis: tumble sideways — lands back at 0° ──
  // Always starts from 0 (canonical snap), so we just add N full rotations.
  const fullRotZ = 2 + Math.floor(Math.random() * 4) // 2–5 full spins
  const dirZ = Math.random() < 0.5 ? 1 : -1
  const targetRotZ = dirZ * fullRotZ * 360

  const startRotX = drumRotX.value
  const startRotY = drumRotY.value
  const startRotZ = drumRotZ.value
  const duration = 3200 + Math.random() * 700
  const startTime = performance.now()

  cancelAnimationFrame(animId)

  function frame(): void {
    const t = Math.min((performance.now() - startTime) / duration, 1)
    const e = easeOutQuart(t)

    // All three axes driven by the same easing — they tumble together and settle together
    drumRotX.value = startRotX + (targetRotX - startRotX) * e
    drumRotY.value = startRotY + (targetRotY - startRotY) * e
    drumRotZ.value = startRotZ + (targetRotZ - startRotZ) * e

    if (t < 1) {
      animId = requestAnimationFrame(frame)
      return
    }

    // Snap to canonical values — prevents float drift accumulating over many rolls
    drumRotX.value = -10
    drumRotY.value = targetFaceAngle
    drumRotZ.value = 0
    isRolling.value = false
    winnerIndex.value = wIdx
    emit('winner', winnerName)
  }

  animId = requestAnimationFrame(frame)
}

onUnmounted(() => cancelAnimationFrame(animId))
defineExpose({ spin })
</script>

<template>
  <div class="flex w-full flex-col items-center gap-8">
    <!-- ── Empty state ── -->
    <div
      v-if="names.length === 0"
      class="flex w-full flex-col items-center justify-center gap-3 py-16 text-text-dim"
    >
      <svg aria-hidden="true" class="opacity-30" height="64" viewBox="0 0 64 64" width="64">
        <rect
          fill="none"
          height="50"
          rx="8"
          stroke="currentColor"
          stroke-width="3"
          width="50"
          x="7"
          y="7"
        />
        <circle cx="32" cy="32" fill="currentColor" r="5" />
      </svg>
      <p class="font-display text-sm tracking-wide">Enter names to roll the die</p>
    </div>

    <template v-else>
      <!-- ── 3D die viewport ── -->
      <div class="die-viewport" :style="{ perspective: `${perspectivePx}px` }">
        <!--
          The drum sits at the viewport center (via flexbox).
          Its explicit width/height equals one face so that all faces'
          position:absolute origin aligns at the drum's center.
        -->
        <!-- Shadow wrapper sits OUTSIDE preserve-3d so filter doesn't flatten it -->
        <div class="drum-shadow">
          <div
            class="drum"
            :style="{
              width: `${panelWidth}px`,
              height: `${PANEL_HEIGHT}px`,
              transform: `rotateX(${drumRotX}deg) rotateY(${drumRotY}deg) rotateZ(${drumRotZ}deg)`,
            }"
          >
            <!-- N lateral faces — one per name, arranged in a prism ring -->
            <div
              v-for="(name, i) in names"
              :key="i"
              class="die-face"
              :class="{ 'die-face--winner': !isRolling && winnerIndex === i }"
              :style="{
                fontSize: `${faceFontSize}px`,
                transform: `rotateY(${i * anglePerFace}deg) translateZ(${inradius}px)`,
              }"
            >
              <span class="face-label">{{ name }}</span>
            </div>

            <!-- Top & bottom caps (decorative — only visible during tilt) -->
            <div
              class="die-cap"
              :style="{
                width: `${panelWidth}px`,
                height: `${panelWidth}px`,
                transform: `rotateX(90deg) translateZ(${PANEL_HEIGHT / 2}px) translateY(${-(panelWidth - PANEL_HEIGHT) / 2}px)`,
              }"
            />
            <div
              class="die-cap"
              :style="{
                width: `${panelWidth}px`,
                height: `${panelWidth}px`,
                transform: `rotateX(-90deg) translateZ(${PANEL_HEIGHT / 2}px) translateY(${(panelWidth - PANEL_HEIGHT) / 2}px)`,
              }"
            />
          </div>
        </div>
      </div>

      <!-- ── Status text ── -->
      <p
        v-if="isRolling"
        class="font-display animate-pulse text-sm tracking-[0.15em] text-accent-amber"
      >
        THE DIE IS ROLLING…
      </p>
      <p v-else class="font-display text-sm tracking-[0.12em] text-text-dim">
        Roll the die — fate will choose
      </p>

      <!-- ── Roll button ── -->
      <button
        :disabled="isRolling || names.length < 2"
        class="font-display bg-accent-coral px-14 py-4 text-base font-bold tracking-[0.15em] text-bg-deep transition-all hover:bg-accent-amber active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        type="button"
        @click="spin"
      >
        {{ isRolling ? 'ROLLING\u2026' : 'ROLL THE DIE' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
/* ── Perspective viewport ────────────────────────────── */
.die-viewport {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 260px;
  perspective-origin: 50% 48%;
}

/* ── Shadow host — must be a plain box OUTSIDE the preserve-3d tree.
   CSS filter on a preserve-3d element collapses it to 2D in all browsers. */
.drum-shadow {
  filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.65));
}

/* ── Drum (the prism die) ────────────────────────────── */
.drum {
  position: relative;
  transform-style: preserve-3d;
}

/* ── Lateral face base ───────────────────────────────── */
.die-face {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 10px;
  /* Subtle two-tone gradient simulates a light source above */
  background: linear-gradient(160deg, #1e3354 0%, #111e30 60%, #0d1726 100%);
  border: 1.5px solid rgba(255, 107, 74, 0.28);
  border-radius: 8px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    inset 0 -1px 0 rgba(0, 0, 0, 0.35),
    inset 2px 0 0 rgba(255, 255, 255, 0.035),
    inset -2px 0 0 rgba(0, 0, 0, 0.25);
  /* Must be visible — on a prism all but the front face are "backwards".
     backface-visibility:hidden would hide them even when they face the camera
     from the side, because the browser checks the face normal, not the screen angle. */
  backface-visibility: visible;
}

/* ── Name label on each face ─────────────────────────── */
.face-label {
  color: #c8c2b8;
  font-family: 'Be Vietnam Pro', sans-serif;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.025em;
  word-break: break-word;
  /* Clamp long names to 3 lines */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  max-width: 100%;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

/* ── Winner face highlight ───────────────────────────── */
.die-face--winner {
  border-color: rgba(255, 107, 74, 0.9);
  background: linear-gradient(160deg, #24344d 0%, #14202e 60%, #0f1a28 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 107, 74, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.35),
    0 0 22px rgba(255, 107, 74, 0.4),
    0 0 60px rgba(255, 107, 74, 0.15);
}

.die-face--winner .face-label {
  color: #ff6b4a;
  text-shadow:
    0 0 10px rgba(255, 107, 74, 0.55),
    0 1px 4px rgba(0, 0, 0, 0.5);
}

/* ── End caps (top / bottom of the prism) ───────────────
   They're decorative — only peeked at from the slight X tilt.
   Using backface-visibility:hidden keeps them invisible when facing away. */
.die-cap {
  position: absolute;
  top: 0;
  left: 0;
  background: linear-gradient(135deg, #152030, #0d1520);
  border: 1px solid rgba(255, 107, 74, 0.18);
  border-radius: 6px;
  backface-visibility: hidden;
}
</style>
