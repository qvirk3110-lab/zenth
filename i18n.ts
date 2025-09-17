
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: {
          // General
          "appTitle": "Zenith",
          "loading": "Loading...",
          // Navigation
          "dashboard": "Dashboard",
          "history": "History",
          "stats": "Graphs/Stats",
          "profile": "Profile",
          "settings": "Settings",
          "about": "About",
          // Auth
          "login": "Login",
          "signup": "Sign Up",
          "logout": "Logout",
          "name": "Name",
          "email": "Email",
          "password": "Password",
          "confirmPassword": "Confirm Password",
          // Dashboard
          "todaysSchedule": "Today's Schedule",
          "taskManager": "Task Manager",
          "addTask": "Add Task",
          "addNewTask": "Add a new task...",
          "noTasks": "No tasks for today. Add one!",
          "currentTask": "Current Task"
          // And so on...
        }
      },
      ur: {
        translation: {
          // General
          "appTitle": "زینت",
          "loading": "لوڈ ہو رہا ہے۔۔۔",
          // Navigation
          "dashboard": "ڈیش بورڈ",
          "history": "تاریخ",
          "stats": "گرافس/اعداد و شمار",
          "profile": "پروفائل",
          "settings": "ترتیبات",
          "about": "ہمارے بارے میں",
          // Auth
          "login": "لاگ ان کریں",
          "signup": "سائن اپ",
          "logout": "لاگ آوٹ",
          "name": "نام",
          "email": "ای میل",
          "password": "پاس ورڈ",
          "confirmPassword": "پاس ورڈ کی تصدیق کریں",
          // Dashboard
          "todaysSchedule": "آج کا شیڈول",
          "taskManager": "ٹاسک مینیجر",
          "addTask": "ٹاسک شامل کریں",
          "addNewTask": "ایک نیا ٹاسک شامل کریں...",
          "noTasks": "آج کے لیے کوئی ٹاسک نہیں ہے۔ ایک شامل کریں!",
          "currentTask": "موجودہ ٹاسک"
        }
      }
    }
  });

export default i18n;