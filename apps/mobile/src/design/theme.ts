export const colors = {
  coral: "#ef6a5b",
  cream: "#f6f0e5",
  ink: "#26312c",
  mint: "#93c9ad",
  plum: "#74517d",
  sunshine: "#f4c95d",
  white: "#ffffff",
} as const;

export const shadows = {
  pop: {
    shadowColor: colors.ink,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
  },
} as const;
