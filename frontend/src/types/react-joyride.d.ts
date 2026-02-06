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
    action?: string
    index?: number
    status: string
    step?: Step
    type?: string
  }

  export const STATUS: {
    FINISHED: string
    SKIPPED: string
  }

  export const ACTIONS: {
    PREV: string
    NEXT: string
    CLOSE: string
    SKIP: string
    START: string
  }

  export const EVENTS: {
    STEP_AFTER: string
    TARGET_NOT_FOUND: string
    TOOLTIP: string
  }

  const Joyride: ComponentType<{
    steps: Step[]
    run?: boolean
    stepIndex?: number
    continuous?: boolean
    disableScrolling?: boolean
    scrollToFirstStep?: boolean
    showProgress?: boolean
    showSkipButton?: boolean
    callback?: (data: CallBackProps) => void
    styles?: Record<string, unknown>
  }>

  export default Joyride
}
