"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText: string;
  actionHref: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  actionHref,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center p-12 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-xl font-bold text-theme-primary mb-2">{title}</h3>
      <p className="text-theme-secondary mb-6 max-w-md">{description}</p>
      <Link href={actionHref}>
        <Button className="bg-[#3A7BD5] hover:bg-[#2A5BA5] text-white px-6">
          {actionText}
        </Button>
      </Link>
    </motion.div>
  );
}

