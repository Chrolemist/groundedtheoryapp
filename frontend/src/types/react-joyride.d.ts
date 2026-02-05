declare module 'react-joyride' {
  import type { ComponentType, ReactNode } from 'react'

  export type Placement =
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'center'

  export type Step = {
    target: string | HTMLElement
    content: ReactNode
    placement?: Placement
    disableBeacon?: boolean
  }

  export type CallBackProps = {
    status: string
  }

  export const STATUS: {
    FINISHED: string
    SKIPPED: string
  }

  const Joyride: ComponentType<{
    steps: Step[]
    run?: boolean
    continuous?: boolean
    scrollToFirstStep?: boolean
    showProgress?: boolean
    showSkipButton?: boolean
    callback?: (data: CallBackProps) => void
    styles?: Record<string, unknown>
  }>

  export default Joyride
}
