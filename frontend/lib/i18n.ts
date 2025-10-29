import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import * as Localization from "expo-localization"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Translation resources
const resources = {
  en: {
    translation: {
      // Tabs
      "tabs.home": "BabblinGo",
      "tabs.tests": "Tests",
      "tabs.progress": "Progress",
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
      "progress.title": "Progress",
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

      // Settings
      "settings.title": "Settings",
      "settings.placeholder": "App settings go here",
      "settings.viewRecords": "View Learning Records",
      "settings.language": "Language",
      "settings.languageDescription": "Choose your preferred language",
      "settings.system": "System Default",
    },
  },
  zh: {
    translation: {
      // Tabs
      "tabs.home": "BabblinGo",
      "tabs.tests": "测试",
      "tabs.progress": "进度",
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
      "progress.title": "学习进度",
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

      // Settings
      "settings.title": "设置",
      "settings.placeholder": "应用设置",
      "settings.viewRecords": "查看学习记录",
      "settings.language": "语言",
      "settings.languageDescription": "选择您的首选语言",
      "settings.system": "跟随系统",
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
