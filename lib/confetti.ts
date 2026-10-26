import confetti from "canvas-confetti";

export function fireSaveConfetti() {
  confetti({
    particleCount: 70,
    spread: 65,
    startVelocity: 38,
    scalar: 0.9,
    colors: ["#ff6b57", "#62c6a5", "#ffc857", "#725a7a"],
    origin: { y: 0.75 },
  });
}
