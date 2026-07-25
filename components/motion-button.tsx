"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import type { PropsWithChildren } from "react";

export function MotionButton({ children, className = "", ...props }: PropsWithChildren<HTMLMotionProps<"button">>) {
  return <motion.button whileHover={{ y: -2 }} whileTap={{ y: 4, scale: .98 }} transition={{ type: "spring", stiffness: 450, damping: 25 }} className={className} {...props}>{children}</motion.button>;
}
