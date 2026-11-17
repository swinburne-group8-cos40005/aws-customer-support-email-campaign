export type SendMode = "now" | "later"

export type AppView =
  | "overview"
  | "campaign"
  | "templates"
  | "audience"
  | "settings"
  | "help"

export type Segment = {
  id: number
  name: string
  desc: string
  contacts: string
  growth: string
}

export type WorkspaceSettings = {
  fullName: string
  email: string
  workspaceName: string
  timezone: string
  senderName: string
  replyTo: string
  campaignUpdates: boolean
  weeklyDigest: boolean
  audienceAlerts: boolean
}
