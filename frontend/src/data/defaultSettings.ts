import { type WorkspaceSettings } from "@/types"

export const defaultWorkspaceSettings: WorkspaceSettings = {
  fullName: "",
  email: "",
  workspaceName: "",
  timezone: "",
  senderName: "",
  replyTo: "",
  campaignUpdates: false,
  weeklyDigest: false,
  audienceAlerts: false,
}
