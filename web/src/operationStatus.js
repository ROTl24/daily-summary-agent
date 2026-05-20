export function getReportFeedback({ reportState, error }) {
  if (reportState === "generating") {
    return {
      tone: "busy",
      text: "正在生成日报，请稍候。DeepSeek 返回前请不要重复点击。",
    };
  }

  if (reportState === "error") {
    return {
      tone: "error",
      text: `生成失败：${error || "请检查配置和网络后重试。"}`,
    };
  }

  if (reportState === "success") {
    return {
      tone: "success",
      text: "日报已生成，可在右侧编辑并保存。",
    };
  }

  return { tone: "neutral", text: "" };
}

export function getStatusTone({ activeTask, error }) {
  if (error) {
    return "error";
  }

  if (activeTask !== "idle") {
    return "busy";
  }

  return "neutral";
}
