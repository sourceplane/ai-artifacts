import Logo from './logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DiscordLogoIcon,
  GitHubLogoIcon,
  TwitterLogoIcon,
} from '@radix-ui/react-icons'
import { SITE_NAME } from '@/lib/site'
import { Menu, Trash, Undo } from 'lucide-react'
import Link from 'next/link'

export function NavBar({
  onClear,
  canClear,
  onSocialClick,
  onUndo,
  canUndo,
}: {
  onClear: () => void
  canClear: boolean
  onSocialClick: (target: 'github' | 'x' | 'discord') => void
  onUndo: () => void
  canUndo: boolean
}) {
  return (
    <nav className="w-full flex bg-background py-4">
      <div className="flex flex-1 items-center">
        <Link href="/" className="flex items-center gap-2" target="_blank">
          <Logo height={24} width={54} />
          <h1 className="whitespace-pre">{SITE_NAME} on </h1>
        </Link>
        <Link
          href="https://e2b.dev"
          className="underline decoration-[rgba(229,123,0,.3)] decoration-2 text-[#ff8800]"
          target="_blank"
        >
          E2B
        </Link>
      </div>
      <div className="flex items-center gap-1 md:gap-4">
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
              >
                <Undo className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClear}
                disabled={!canClear}
              >
                <Trash className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <ThemeToggle />
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* Upstream's account menu, without the account: there is no
            sign-in here (Supabase is left out). */}
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Menu">
                    <Menu className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Menu</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuItem
              onClick={() => {
                window.open('https://e2b.dev', '_blank')
              }}
            >
              <Logo className="mr-2 h-4 w-auto text-muted-foreground" />
              About E2B
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSocialClick('github')}>
              <GitHubLogoIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              Source on GitHub
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSocialClick('discord')}>
              <DiscordLogoIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              E2B on Discord
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSocialClick('x')}>
              <TwitterLogoIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              E2B on X
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
