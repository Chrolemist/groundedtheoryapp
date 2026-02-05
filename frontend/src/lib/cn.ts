import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type ClassValue = string | number | null | false | undefined | ClassValue[] | Record<string, boolean>

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
