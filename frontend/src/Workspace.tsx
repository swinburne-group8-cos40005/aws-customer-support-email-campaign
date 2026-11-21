import { useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { SectionHeader } from "@/components/layout/SectionHeader"
import { defaultWorkspaceSettings } from "@/data/defaultSettings"
import { pageTitles } from "@/data/pageTitles"
import { useCampaignDraft } from "@/hooks/useCampaignDraft"
import { AudiencePage } from "@/pages/AudiencePage"
import { CampaignPage } from "@/pages/CampaignPage"
import { HelpPage } from "@/pages/HelpPage"
import { OverviewPage } from "@/pages/OverviewPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { TemplatesPage } from "@/pages/TemplatesPage"
import { type AppView, type WorkspaceSettings } from "@/types"

export function Workspace({
  darkMode,
  onLogout,
  onToggleTheme,
}: {
  darkMode: boolean
  onLogout: () => void
  onToggleTheme: () => void
}) {
  const [view, setView] = useState<AppView>("campaign")
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(
    defaultWorkspaceSettings,
  )
  const draft = useCampaignDraft()

  return (
    <AppShell
      darkMode={darkMode}
      onLogout={onLogout}
      onViewChange={setView}
      view={view}
    >
      {view === "campaign" ? (
        <CampaignPage
          darkMode={darkMode}
          draft={draft}
          onOpenSettings={() => setView("settings")}
          onToggleTheme={onToggleTheme}
        />
      ) : (
        <>
          <SectionHeader
            darkMode={darkMode}
            eyebrow={view === "settings" ? "Settings" : "Postly"}
            onBack={() => setView("campaign")}
            onToggleTheme={onToggleTheme}
            title={pageTitles[view]}
          />
          {view === "overview" && (
            <OverviewPage
              onCreate={() => {
                setView("campaign")
              }}
            />
          )}
          {view === "templates" && (
            <TemplatesPage
              templates={draft.templates}
              selected={draft.templateId}
              onSelect={draft.setTemplateId}
              onUseTemplate={() => setView("campaign")}
            />
          )}
          {view === "audience" && (
            <AudiencePage segments={draft.segments} />
          )}
          {view === "settings" && (
            <SettingsPage
              onSave={setWorkspaceSettings}
              settings={workspaceSettings}
            />
          )}
          {view === "help" && <HelpPage />}
        </>
      )}
    </AppShell>
  )
}