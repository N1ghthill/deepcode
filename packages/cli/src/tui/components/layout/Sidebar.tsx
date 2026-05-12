import React, { useState, useMemo, useRef, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { Session, Activity } from "@deepcode/shared";
import type { ApprovalRequest, SessionStats, TaskPlan } from "@deepcode/core";
import { t } from "../../i18n/index.js";
import { TelemetrySidebar } from "../shared/TelemetrySidebar.js";
import { truncate } from "../../utils/truncate.js";
import { formatAgentStatus } from "../../utils/status-format.js";

export type SidebarTab = "sessions" | "activities" | "telemetry" | "approvals" | "plan";

export interface SidebarProps {
  theme: ThemeColors;
  activeTab: SidebarTab;
  sessions: Session[];
  activities: Activity[];
  toolCalls: Array<{ id: string; name: string; args: string; result?: string }>;
  activeSessionId: string;
  status?: string;
  activeTarget?: string;
  messageCount?: number;
  approvalCount?: number;
  currentApprovals?: ApprovalRequest[];
  onTabChange?: (tab: SidebarTab) => void;
  onApprovalAction?: (requestId: string, allowed: boolean, scope: "once" | "session" | "always") => void;
  telemetryStats: SessionStats | null;
  telemetryBreakdown?: Record<string, number>;
  currentPlan?: TaskPlan;
  hotkeysEnabled?: boolean;
}

export function Sidebar({
  theme,
  activeTab,
  sessions,
  activities,
  toolCalls,
  activeSessionId,
  status,
  activeTarget,
  messageCount = 0,
  approvalCount = 0,
  currentApprovals = [],
  onTabChange,
  onApprovalAction,
  telemetryStats,
  telemetryBreakdown,
  currentPlan,
  hotkeysEnabled,
}: SidebarProps) {
  useInput((input) => {
    if (input === "1") onTabChange?.("sessions");
    else if (input === "2") onTabChange?.("activities");
    else if (input === "3") onTabChange?.("telemetry");
    else if (input === "4" && currentApprovals.length > 0) onTabChange?.("approvals");
    else if (input === "5" && currentPlan) onTabChange?.("plan");
  }, { isActive: Boolean(hotkeysEnabled) });

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.border}
      paddingX={1}
    >
      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.fgMuted}>
          {t("sidebarSession")}{truncate(activeSessionId, 14)}
        </Text>
        <Text color={theme.fgMuted}>
          {t("statusLabel")}<Text color={status === "error" ? theme.error : theme.success}>{formatAgentStatus(status ?? "idle")}</Text>
        </Text>
        <Text color={theme.fgMuted}>
          {t("sidebarTarget")}{truncate(activeTarget ?? t("notConfigured"), 22)}
        </Text>
        <Text color={theme.fgMuted}>
          {t("sidebarMsgs")}{messageCount} \u2022 {t("sidebarTools")}{toolCalls.length}
          {approvalCount > 0 ? ` \u2022 ${t("sidebarApprovals")}${approvalCount}` : ""}
        </Text>
      </Box>

      <Box>
        <TabButton
          label={t("sidebarTabSessions")}
          active={activeTab === "sessions"}
          theme={theme}
        />
        <Text> </Text>
        <TabButton
          label={t("sidebarTabActivities")}
          active={activeTab === "activities"}
          theme={theme}
        />
        <Text> </Text>
        <TabButton
          label={t("sidebarTabTelemetry")}
          active={activeTab === "telemetry"}
          theme={theme}
        />
        <Text> </Text>
        <TabButton
          label={`${t("sidebarTabApprovals")}${approvalCount > 0 ? `(${approvalCount})` : ""}`}
          active={activeTab === "approvals"}
          theme={theme}
        />
        {currentPlan && (
          <>
            <Text> </Text>
            <TabButton
              label={t("sidebarTabPlan")}
              active={activeTab === "plan"}
              theme={theme}
            />
          </>
        )}
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {activeTab === "sessions" && (
          <SessionsList
            sessions={sessions}
            activeSessionId={activeSessionId}
            theme={theme}
          />
        )}

        {activeTab === "activities" && (
          <ActivitiesList
            activities={activities}
            toolCalls={toolCalls}
            theme={theme}
          />
        )}

        {activeTab === "telemetry" && (
          <TelemetrySidebar theme={theme} stats={telemetryStats} toolBreakdown={telemetryBreakdown} />
        )}

        {activeTab === "approvals" && (
          <ApprovalList
            approvals={currentApprovals}
            theme={theme}
            onApprovalAction={onApprovalAction}
          />
        )}

        {activeTab === "plan" && currentPlan && (
          <PlanList plan={currentPlan} theme={theme} />
        )}
      </Box>
    </Box>
  );
}

function TabButton({
  label,
  active,
  theme,
}: {
  label: string;
  active: boolean;
  theme: ThemeColors;
}) {
  return (
    <Text bold={active} color={active ? theme.primary : theme.fgMuted}>
      [{label}]
    </Text>
  );
}

function PlanList({
  plan,
  theme,
}: {
  plan: TaskPlan;
  theme: ThemeColors;
}) {
  const progress = plan.tasks.filter((t) => t.status === "completed").length;
  const total = plan.tasks.length;
  const percentage = Math.round((progress / total) * 100);

  const statusIcon = (status: string): string => {
    switch (status) {
      case "completed": return "✓";
      case "running": return "▶";
      case "failed": return "✗";
      default: return "○";
    }
  };

  const statusColor = (status: string): string => {
    switch (status) {
      case "completed": return theme.success ?? theme.primary;
      case "running": return theme.accent;
      case "failed": return theme.error;
      default: return theme.fgMuted;
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold color={theme.primary}>
        {plan.objective.slice(0, 40)}...
      </Text>
      <Text color={theme.fgMuted}>
        {t("sidebarProgress")}{progress}/{total} ({percentage}%)
      </Text>
      <Text> </Text>
      {plan.tasks.map((task) => (
        <Text key={task.id} color={statusColor(task.status)}>
          {statusIcon(task.status)} {task.description.slice(0, 35)}
          {task.description.length > 35 ? "..." : ""}
        </Text>
      ))}
    </Box>
  );
}

function SessionsList({
  sessions,
  activeSessionId,
  theme,
}: {
  sessions: Session[];
  activeSessionId: string;
  theme: ThemeColors;
}) {
  const visibleSessions = useMemo(() => sessions.slice(0, 10), [sessions]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedIndexRef = useRef(selectedIndex);
  
  // Update ref when state changes
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Update state when dependencies change
  useEffect(() => {
    const newIndex = Math.max(0, visibleSessions.findIndex((s) => s.id === activeSessionId));
    setSelectedIndex(newIndex);
    selectedIndexRef.current = newIndex;
  }, [visibleSessions, activeSessionId]);

  if (sessions.length === 0) {
    return <Text color={theme.fgMuted}>{t("sidebarNoSessions")}</Text>;
  }

  return (
    <Box flexDirection="column">
      {visibleSessions.map((session, index) => {
        const isActive = session.id === activeSessionId;
        const isFocused = index === selectedIndex;
        const isDeleted = !!session.metadata?.deletedAt;
        const msgCount = session.messages.length;
        const timeStr = formatSessionTime(session.updatedAt || session.createdAt);
        const providerStr = `${session.provider}/${(session.model || "?").slice(0, 12)}`;
        return (
          <Text
            key={session.id}
            color={isDeleted ? theme.fgMuted : isActive ? theme.primary : isFocused ? theme.accent : theme.fgMuted}
            bold={isActive || isFocused}
            dimColor={isDeleted}
          >
            {isFocused ? "▸ " : isActive ? "▶ " : "  "}
            {isDeleted ? "☠ " : ""}
            <Text dimColor>[{msgCount}m]</Text> {timeStr} {providerStr}
            {isDeleted ? ` ${t("sidebarDeleted")}` : ` ${session.status}`}
          </Text>
        );
      })}
      <Text> </Text>
      <Text color={theme.fgMuted}>{t("sidebarCtrlOHint")}</Text>
    </Box>
  );
}

function formatSessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("sidebarNow");
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function ActivitiesList({
  activities,
  toolCalls,
  theme,
}: {
  activities: Activity[];
  toolCalls: Array<{ id: string; name: string; args: string }>;
  theme: ThemeColors;
}) {
  const icon = (type: string): string => {
    if (type.includes("read")) return "📖";
    if (type.includes("write")) return "✏️";
    if (type.includes("bash")) return "⚡";
    if (type.includes("search")) return "🔍";
    return "•";
  };

  return (
    <Box flexDirection="column">
      {activities.length === 0 && toolCalls.length === 0 && (
        <Text color={theme.fgMuted}>{t("sidebarNoActivity")}</Text>
      )}

      {toolCalls.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={theme.accent}>{t("sidebarToolCallsLabel")}</Text>
          {toolCalls.slice(-5).map((tc) => (
            <Text key={tc.id} color={theme.fgMuted}>
              → {tc.name}
            </Text>
          ))}
        </Box>
      )}

      {activities.length > 0 && (
        <Box flexDirection="column">
          <Text bold>{t("sidebarRecent")}</Text>
          {activities.slice(-8).map((activity) => (
            <Text key={activity.id} color={theme.fgMuted}>
              {icon(activity.type)} {activity.message.slice(0, 50)}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function ApprovalList({
  approvals,
  theme,
  onApprovalAction,
}: {
  approvals: ApprovalRequest[];
  theme: ThemeColors;
  onApprovalAction?: (requestId: string, allowed: boolean, scope: "once" | "session" | "always") => void;
}) {
  if (approvals.length === 0) {
    return <Text color={theme.fgMuted}>{t("sidebarNoPendingApprovals")}</Text>;
  }

  const riskColor = (level: string): string => {
    if (level === "dangerous") return theme.error;
    if (level === "shell") return theme.warning;
    if (level === "write") return theme.warning;
    if (level === "git_local") return theme.accent;
    return theme.fgMuted;
  };

  return (
    <Box flexDirection="column">
      <Text bold color={theme.warning}>{t("sidebarPendingApprovals", { count: approvals.length })}</Text>
      <Text> </Text>
      {approvals.map((req, idx) => (
        <Box key={req.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row">
            <Text color={riskColor(req.level)} bold>[{idx + 1}]</Text>
            <Text> </Text>
            <Text color={riskColor(req.level)}>
              {req.level === "shell" ? "⚡" : req.level === "dangerous" ? "🔴" : "✏️"} {req.operation.slice(0, 30)}
              {req.operation.length > 30 ? "..." : ""}
            </Text>
          </Box>
          {req.path && (
            <Text color={theme.fgMuted} dimColor>
              📁 {req.path}
            </Text>
          )}
          {onApprovalAction && (
            <Box flexDirection="row" marginTop={1}>
              <Text
                color={theme.success}
                bold
              >
                {t("approveAction")}
              </Text>
              <Text> </Text>
              <Text
                color={theme.primary}
                bold
              >
                {t("approveAlwaysAction")}
              </Text>
              <Text> </Text>
              <Text
                color={theme.accent}
                bold
              >
                {t("approveSessionAction")}
              </Text>
              <Text> </Text>
              <Text
                color={theme.error}
                bold
              >
                {t("denyAction")}
              </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
