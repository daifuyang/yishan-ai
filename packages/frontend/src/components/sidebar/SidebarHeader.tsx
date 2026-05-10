'use client';

import { MessageCirclePlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function LogoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <title>App Logo</title>
      <path
        d="M12 2L2 9L12 16L22 9L12 2Z"
        stroke="#171717"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M2 15L12 22L22 15"
        stroke="#171717"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M2 9L12 2L22 9"
        stroke="#171717"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function SidebarHeader() {
  const router = useRouter();

  const handleNewChat = () => {
    router.push('/');
  };

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/"
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent/80 transition-colors"
            >
              <LogoIcon />
              <span className="text-base font-bold text-black group-data-[collapsible=icon]:hidden">
                Yishan
              </span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Yishan AI</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className="h-8 w-8 p-0 hover:bg-accent rounded-md transition-colors" />
          </TooltipTrigger>
          <TooltipContent side="left">收起侧边栏</TooltipContent>
        </Tooltip>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="w-full justify-start gap-2 h-9 px-3 text-sm font-medium shadow-none"
          >
            <MessageCirclePlus className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">新建对话</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">新建对话</TooltipContent>
      </Tooltip>
    </div>
  );
}
