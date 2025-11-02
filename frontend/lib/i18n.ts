import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import * as Localization from "expo-localization"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Translation resources
const resources = {
  en: {
    translation: {
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.displayName": "Display Name",
  "auth.loginError": "Login failed: {{error}}",
  "auth.loginSuccess": "Login successful!",
  "auth.loggingIn": "Logging in...",
  "auth.registrationError": "Registration failed: {{error}}",
  "auth.registrationSuccess": "Registration successful! Check your email for verification.",
  "auth.registering": "Registering...",
  "auth.noAccount": "Don't have an account?",
  "auth.alreadyHaveAccount": "Already have an account?",
  "settings.login": "Log In",
  "settings.register": "Register",
  "settings.logout": "Log Out",
  "profile.title": "User Profile",
  "profile.noEmail": "N/A",
  "profile.noDisplayName": "N/A",
      // Tabs
      "tabs.home": "BabblinGo",
      "tabs.tests": "Tests",
      "tabs.progress": "History",
      "tabs.settings": "Settings",

      // Home screen
      "home.title": "BabblinGo",
      "home.lesson": "Lesson {{number}}",
      "home.noLessons": "No lessons found for the Novice level.",
      "home.loadError": "Unable to load lessons. Pull to refresh and try again.",
      "home.noDisplay": "No lessons to display.",

      // Tests screen
      "tests.title": "Tests",
      "tests.placementTitle": "ACTFL Language Proficiency Self-Assessment",
      "tests.placementDescription": "Assess your current language proficiency level",
      "tests.achievementTitle": "Beginner Course Achievement Test",
      "tests.achievementDescription": "Check if you have mastered the content from our beginner course",

      // Lesson screen
      "lesson.back": "Back",
      "lesson.noModules": "No modules available for this lesson.",
      "lesson.notFound": "Lesson not found.",
      "lesson.loading": "Loading...",
      "lesson.error": "Unable to load lesson. Try again later.",
      "lesson.downloading": "Downloading...",
      "lesson.cache.title": "Cache Management",
      "lesson.cache.status": "Status",
      "lesson.cache.statusFull": "Fully Cached",
      "lesson.cache.statusPartial": "Partially Cached",
      "lesson.cache.statusNone": "Not Cached",
      "lesson.cache.clearTitle": "Clear Cache?",
      "lesson.cache.clearMessage": "This will delete all cached media for this lesson.",
      "lesson.cache.cleared": "Cache Cleared",
      "lesson.cache.clearedMessage": "Media files have been removed.",
      "lesson.cache.clearError": "Failed to clear cache.",
      "lesson.cache.redownloadTitle": "Re-download Media?",
      "lesson.cache.redownloadMessage": "This will download fresh copies of all media files.",
      "lesson.cache.redownload": "Re-download All",
      "lesson.cache.redownloadError": "Failed to re-download media.",
      "lesson.startLearning": "Start learning",
      "lesson.sessionComplete": "Session complete",
      "lesson.timeSpent": "Time spent",
      "lesson.sessionTarget": "Session target",
      "lesson.startAnother": "Start another session",

      // Timer
      "timer.set": "Set session timer",
      "timer.minutes": "minutes",
      "timer.seconds": "seconds",
      "timer.close": "Close",
      "timer.cancel": "Cancel timer",
      "timer.start": "Start",
      "timer.restart": "Restart",
      "timer.timeUp": "Time's up",
      "timer.timeUpMessage": "Would you like to set a new timer and continue, or end this session?",
      "timer.setNew": "Set new timer",
      "timer.endSession": "End session",

      // Player
      "player.speed": "Speed",

      // Progress screen
      "progress.title": "History",
      "progress.today": "Today",
      "progress.thisWeek": "This Week",
      "progress.allTime": "All Time",
      "progress.last7days": "Last 7 days",
      "progress.last30days": "Last 30 days",
      "progress.alltime": "All time",
      "progress.allLessons": "All lessons",
      "progress.weekly": "Weekly",
      "progress.topLessons": "Top lessons",
      "progress.noData": "No data",
      "progress.sessions": "{{count}} session",
      "progress.sessions_other": "{{count}} sessions",
      "progress.noSessions": "No sessions yet. Start a timed session from any lesson to see your learning history here.",
      "progress.sectionToday": "Today",
      "progress.sectionWeek": "This Week",
      "progress.sectionEarlier": "Earlier",
      "progress.delete": "Delete",
      "progress.planned": "planned",
  "progress.actual": "actual",
  "progress.unfinished": "unfinished",

      // Settings
      "settings.title": "Settings",
      "settings.placeholder": "App settings go here",
      "settings.viewRecords": "View Learning Records",
  "settings.language": "Language",
  "settings.languageDescription": "Choose your preferred language",
  "settings.theme": "Theme",
  "settings.themeDescription": "Select your preferred appearance mode",
  "settings.themeSystem": "System Default",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
      "settings.learningPreferences": "Learning Preferences",
      "settings.learningPreferencesDescription": "Default session length and playback speed",
      "settings.system": "System Default",
      "settings.about": "About",
      "settings.cache.title": "Media Cache",
      "settings.cache.description": "Cached media files for offline access",
      "settings.cache.files": "Files",
      "settings.cache.size": "Size",
      "settings.cache.clearConfirmTitle": "Clear Cache?",
      "settings.cache.clearConfirmMessage": "This will delete all cached media files. They will be re-downloaded when needed.",
      "settings.cache.cleared": "Cache Cleared",
      "settings.cache.clearedMessage": "All cached files have been removed.",
      "settings.cache.clearError": "Failed to clear cache. Please try again.",
      "settings.learning.title": "Learning Preferences",
      "settings.learning.sessionLength": "Default Session Length",
      "settings.learning.sessionLengthDesc": "How long you plan to study when starting a learning session",
      "settings.learning.playbackSpeed": "Default Playback Speed",
      "settings.learning.playbackSpeedDesc": "Audio playback speed for learning sessions",
      "settings.learning.saved": "Saved",
      "settings.learning.savedMessage": "Your preferences have been saved.",
      "settings.learning.saveError": "Failed to save preferences.",
      "settings.learning.setSessionLength": "Session length",
      "settings.learning.setPlaybackSpeed": "Playback speed",

      // Session
      "session.startLearning": "Start Learning Session",
      "session.speed": "speed",
      "session.paused": "PAUSED",
      "session.pause": "Pause",
      "session.resume": "Resume",
      "session.stop": "Stop",

      // Common
      "common.cancel": "Cancel",
      "common.clear": "Clear",
      "common.refresh": "Refresh",
      "common.error": "Error",
      "common.loading": "Loading...",
      "common.saving": "Saving...",
      "common.save": "Save Preferences",
      "common.close": "Close",
      "common.done": "Done",
      "common.tapToEdit": "Tap to edit",
      "common.exit": "Exit",
      // Weekday labels
      "common.weekdayShort.mon": "Mo",
      "common.weekdayShort.tue": "Tu",
      "common.weekdayShort.wed": "We",
      "common.weekdayShort.thu": "Th",
      "common.weekdayShort.fri": "Fr",
      "common.weekdayShort.sat": "Sa",
      "common.weekdayShort.sun": "Su",
      // Auth - Forgot Password
      "auth.forgotPassword": "Forgot password",
      "auth.sendReset": "Send reset link",
      "auth.resetSent": "If an account exists for that email, a reset link has been sent.",
      "auth.resetError": "Failed to send reset email: {{error}}",
      "auth.resetInstructions": "Enter your email and we'll send you a link to reset your password.",
      "auth.backToLogin": "Back to login",
    },
  },
  zh: {
    translation: {
      "auth.email": "邮箱",
      "auth.password": "密码",
      "auth.displayName": "昵称",
  "auth.loginError": "登录失败：{{error}}",
  "auth.loginSuccess": "登录成功！",
  "auth.loggingIn": "正在登录...",
  "auth.registrationError": "注册失败：{{error}}",
  "auth.registrationSuccess": "注册成功！请查收验证邮件。",
  "auth.registering": "正在注册...",
  "auth.noAccount": "还没有账号？",
  "auth.alreadyHaveAccount": "已经有账号？",
  "settings.login": "登录",
  "settings.register": "注册",
  "settings.logout": "退出登录",
  "profile.title": "个人信息",
  "profile.noEmail": "无",
  "profile.noDisplayName": "无",
      // Tabs
      "tabs.home": "BabblinGo",
      "tabs.tests": "测试",
      "tabs.progress": "记录",
      "tabs.settings": "设置",

      // Home screen
      "home.title": "BabblinGo",
      "home.lesson": "第 {{number}} 课",
      "home.noLessons": "未找到初级课程。",
      "home.loadError": "无法加载课程。下拉刷新重试。",
      "home.noDisplay": "暂无课程。",

      // Tests screen
      "tests.title": "测试",
      "tests.placementTitle": "ACTFL语言能力自测题",
      "tests.placementDescription": "判断您当前的语言能力水平",
      "tests.achievementTitle": "零基础教练课测试",
      "tests.achievementDescription": "判断您是否已掌握我们的零基础教练课中的内容",

      // Lesson screen
      "lesson.back": "返回",
      "lesson.noModules": "本课程暂无内容。",
      "lesson.notFound": "未找到课程。",
      "lesson.loading": "加载中...",
      "lesson.error": "无法加载课程。请稍后重试。",
      "lesson.downloading": "下载中...",
      "lesson.cache.title": "缓存管理",
      "lesson.cache.status": "状态",
      "lesson.cache.statusFull": "已完全缓存",
      "lesson.cache.statusPartial": "部分缓存",
      "lesson.cache.statusNone": "未缓存",
      "lesson.cache.clearTitle": "清除缓存？",
      "lesson.cache.clearMessage": "这将删除本课程的所有缓存媒体文件。",
      "lesson.cache.cleared": "缓存已清除",
      "lesson.cache.clearedMessage": "媒体文件已删除。",
      "lesson.cache.clearError": "清除缓存失败。",
      "lesson.cache.redownloadTitle": "重新下载媒体？",
      "lesson.cache.redownloadMessage": "这将重新下载所有媒体文件。",
      "lesson.cache.redownload": "重新下载全部",
      "lesson.cache.redownloadError": "重新下载媒体失败。",
      "lesson.startLearning": "开始学习",
      "lesson.sessionComplete": "学习完成",
      "lesson.timeSpent": "学习时长",
      "lesson.sessionTarget": "计划时长",
      "lesson.startAnother": "再来一次",

      // Timer
      "timer.set": "设置学习计时",
      "timer.minutes": "分钟",
      "timer.seconds": "秒",
      "timer.close": "关闭",
      "timer.cancel": "取消计时",
      "timer.start": "开始",
      "timer.restart": "重新开始",
      "timer.timeUp": "时间到",
      "timer.timeUpMessage": "是否设置新的计时并继续学习，还是结束本次学习？",
      "timer.setNew": "设置新计时",
      "timer.endSession": "结束学习",

      // Player
      "player.speed": "速度",

      // Progress screen
      "progress.title": "学习记录",
      "progress.today": "今天",
      "progress.thisWeek": "本周",
      "progress.allTime": "总计",
      "progress.last7days": "最近 7 天",
      "progress.last30days": "最近 30 天",
      "progress.alltime": "全部",
      "progress.allLessons": "全部课程",
      "progress.weekly": "本周",
      "progress.topLessons": "热门课程",
      "progress.noData": "暂无数据",
      "progress.sessions": "{{count}} 次学习",
      "progress.sessions_other": "{{count}} 次学习",
      "progress.noSessions": "暂无学习记录。在任意课程中开始计时学习后，您的学习记录将显示在这里。",
      "progress.sectionToday": "今天",
      "progress.sectionWeek": "本周",
      "progress.sectionEarlier": "更早",
      "progress.delete": "删除",
      "progress.planned": "计划",
  "progress.actual": "实际",
  "progress.unfinished": "未完成",

      // Settings
      "settings.title": "设置",
      "settings.placeholder": "应用设置",
      "settings.viewRecords": "查看学习记录",
  "settings.language": "语言",
  "settings.languageDescription": "选择您的首选语言",
  "settings.theme": "主题",
  "settings.themeDescription": "选择您喜欢的外观模式",
  "settings.themeSystem": "跟随系统",
  "settings.themeLight": "浅色",
  "settings.themeDark": "深色",
      "settings.learningPreferences": "学习偏好设置",
      "settings.learningPreferencesDescription": "设置默认的学习时长和播放速度",
      "settings.system": "跟随系统",
      "settings.about": "关于我们",
      "settings.cache.title": "媒体缓存",
      "settings.cache.description": "已缓存的媒体文件，可离线访问",
      "settings.cache.files": "文件数",
      "settings.cache.size": "大小",
      "settings.cache.clearConfirmTitle": "清除缓存？",
      "settings.cache.clearConfirmMessage": "这将删除所有缓存的媒体文件。需要时会重新下载。",
      "settings.cache.cleared": "缓存已清除",
      "settings.cache.clearedMessage": "所有缓存文件已删除。",
      "settings.cache.clearError": "清除缓存失败，请重试。",
      "settings.learning.title": "学习偏好设置",
      "settings.learning.sessionLength": "默认学习时长",
      "settings.learning.sessionLengthDesc": "开始学习时的默认时长",
      "settings.learning.playbackSpeed": "默认播放速度",
      "settings.learning.playbackSpeedDesc": "学习时音频的默认播放速度",
      "settings.learning.saved": "已保存",
      "settings.learning.savedMessage": "您的偏好设置已保存。",
      "settings.learning.saveError": "保存偏好设置失败。",
      "settings.learning.setSessionLength": "学习时长",
      "settings.learning.setPlaybackSpeed": "播放速度",

      // Session
      "session.startLearning": "开始学习",
      "session.speed": "速度",
      "session.paused": "已暂停",
      "session.pause": "暂停",
      "session.resume": "继续",
      "session.stop": "停止",

      // Common
      "common.cancel": "取消",
      "common.clear": "清除",
      "common.refresh": "刷新",
      "common.error": "错误",
      "common.loading": "加载中...",
      "common.saving": "保存中...",
      "common.save": "保存偏好设置",
      "common.close": "关闭",
      "common.done": "完成",
      "common.tapToEdit": "点击编辑",
      "common.exit": "退出",
      // Weekday labels
      "common.weekdayShort.mon": "周一",
      "common.weekdayShort.tue": "周二",
      "common.weekdayShort.wed": "周三",
      "common.weekdayShort.thu": "周四",
      "common.weekdayShort.fri": "周五",
      "common.weekdayShort.sat": "周六",
      "common.weekdayShort.sun": "周日",
      // Auth - Forgot Password
      "auth.forgotPassword": "忘记密码",
      "auth.sendReset": "发送重置链接",
      "auth.resetSent": "如果该邮箱有账号，我们已发送密码重置邮件。",
      "auth.resetError": "发送重置邮件失败：{{error}}",
      "auth.resetInstructions": "请输入您的邮箱，我们会发送密码重置链接。",
      "auth.backToLogin": "返回登录",
    },
  },
}

const STORAGE_KEY = "app.language"

// Initialize i18n
const initI18n = async () => {
  let savedLanguage: string | null = null
  try {
    savedLanguage = await AsyncStorage.getItem(STORAGE_KEY)
  } catch {}

  const systemLocale = Localization.getLocales()[0]?.languageCode || "en"
  const fallbackLng = systemLocale.startsWith("zh") ? "zh" : "en"

  await i18n.use(initReactI18next).init({
    resources,
    lng: savedLanguage || fallbackLng,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: "v4",
  })
}

// Change language and persist
export const changeLanguage = async (lang: string) => {
  await i18n.changeLanguage(lang)
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang)
  } catch {}
}

initI18n()

export default i18n
