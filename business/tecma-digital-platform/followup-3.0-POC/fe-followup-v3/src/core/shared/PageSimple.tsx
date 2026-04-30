import { ReactNode } from "react";

interface PageSimpleProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export const PageSimple = ({ title, description, children, className }: PageSimpleProps) => {
  return (
    <div className={`flex flex-col h-full ${className ?? ""}`.trim()}>
      <div className="border-b border-[#d3d4da] bg-[#f5f5f7] px-5 py-8 lg:px-20">
        <h1 className="text-2xl font-normal text-[#6e748c]">{title}</h1>
        <p className="mt-2 text-base font-semibold text-[#464c62]">{description}</p>
      </div>
      <div className="flex-1 overflow-auto px-5 pb-10 pt-6 lg:px-20">{children}</div>
    </div>
  );
};
