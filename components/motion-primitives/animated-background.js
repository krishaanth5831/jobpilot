"use client";

import { motion } from "motion/react";
import { Children, cloneElement, useState } from "react";

// A shared highlight that slides between the selected child (filter pills,
// tab rows). Children must accept className and have a unique `data-id`.
export function AnimatedBackground({
  children,
  className,
  defaultValue,
  onValueChange,
  enableHover = false,
}) {
  const [active, setActive] = useState(defaultValue ?? null);

  function select(id) {
    setActive(id);
    onValueChange?.(id);
  }

  return Children.map(children, (child) => {
    const id = child.props["data-id"];
    const isActive = active === id;
    const events = enableHover
      ? { onPointerEnter: () => select(id) }
      : { onClick: () => select(id) };

    return cloneElement(
      child,
      {
        ...events,
        "data-checked": isActive ? "true" : "false",
        className: `relative ${child.props.className ?? ""}`,
      },
      <>
        {isActive && (
          <motion.span
            layoutId="animated-background-highlight"
            className={`absolute inset-0 -z-10 ${className ?? ""}`}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
          />
        )}
        <span className="relative z-10">{child.props.children}</span>
      </>
    );
  });
}
