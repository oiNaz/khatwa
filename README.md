# خُطوة

**خُطوة** تطبيق شخصي لتنظيم المهام، والتخطيط للأسبوع، ومتابعة التركيز والإنجازات. تبقى بياناتك على جهازك، دون حساب أو مزامنة سحابية.

**Khatwa** is a personal task manager for planning your week, focusing on what matters, and tracking your progress. Your data stays on your device—no account or cloud sync required.

## المزايا | Features

- إدارة المهام وترتيب أولوياتها وتحديد مواعيدها وتكرارها.
- تقسيم المهام إلى خطوات فرعية ومتابعة إنجازها.
- عرض اليوم والوارد وكل المهام، وتقويم أسبوعي يبدأ بالأحد، ولوحة كانبان.
- مؤقّت تركيز يحفظ الوقت المنقضي عند تحديث الصفحة أو العودة إليها.
- ٣٤ إنجازًا تُحتسب من نشاطك، مع احتفاء مرئي عند فتح إنجاز جديد.
- واجهة عربية وإنجليزية مع اتجاه RTL/LTR وتنسيق محلي للتواريخ والأرقام.
- مظهر داكن وفاتح وتصميم متجاوب وإمكانية تثبيت التطبيق كتطبيق ويب تقدّمي (PWA).
- نسخ احتياطي واستعادة بصيغة JSON، مع التحقق من البيانات المستوردة.

Khatwa includes task priorities and recurring tasks, subtasks, a Sunday-first calendar, a focus timer, 34 activity-based achievements, Arabic and English with RTL/LTR support, dark and light themes, PWA installation, and JSON backup and restore.

## البدء | Getting started

يتطلب تشغيل المشروع **Node.js 20 أو أحدث** و**npm**.

You need **Node.js 20 or later** and **npm**.

```sh
npm install
npm run dev
```

لإنشاء نسخة الإنتاج وتشغيل الفحوصات:

To create a production build and run the checks:

```sh
npm run build
npm test
npm run lint
```

## الاستخدام | Using Khatwa

- في أول زيارة، اختر **ابدأ خطوتك**. بعد ذلك يفتح التطبيق مباشرة على صفحة اليوم.
- اختر **مهمة جديدة** أو **إضافة سريعة** لإنشاء مهمة. افتح المهمة لإضافة موعد أو تصنيف أو خطوات فرعية.
- استخدم قائمة التنقل للانتقال بين صفحات اليوم والمهام والتقويم والتركيز والإنجازات.
- في صفحة **التركيز**، اختر مهمة ومدة، ثم ابدأ الجلسة. يمكنك إيقافها مؤقتًا أو إنهاؤها.
- بدّل اللغة أو المظهر من الشريط العلوي أو صفحة الإعدادات.
- لحفظ بياناتك أو نقلها، افتح **الإعدادات ← النسخ الاحتياطي والاستعادة**، ثم نزّل نسخة JSON أو استورد نسخة محفوظة.

On your first visit, choose **Take your next step**. Create tasks from **New task** or **Quick add**, then use the navigation to plan, focus, and review achievements. Change the language or theme from the top bar or Settings. Use **Settings → Backup & restore** to download or restore a JSON backup.

**اختصار الإضافة السريعة | Quick add shortcut:** `Ctrl+K` على Windows/Linux أو `Cmd+K` على macOS.

## الخصوصية والبيانات | Privacy and data

تُخزّن المهام والجلسات والتفضيلات والإنجازات في IndexedDB ضمن ملف المتصفح الحالي. لا يرسل التطبيق هذه البيانات إلى خادم، ولا يوفّر حسابات أو مزامنة بين الأجهزة. قد يؤدي مسح بيانات الموقع أو فقدان ملف المتصفح إلى فقدان بياناتك؛ احتفظ بنسخة احتياطية في مكان آمن.

Tasks, sessions, preferences, and achievements are stored in IndexedDB in the current browser profile. The app does not send this personal data to a server and does not sync it across devices. Clearing browser site data or losing access to the browser profile may remove your data, so keep a backup somewhere safe.

البيانات المحلية **غير مشفّرة بواسطة التطبيق**. يعتمد مؤقّت التركيز على ساعة الجهاز، ولا تُضمن التنبيهات أو اكتمال المؤقّت عند إغلاق التطبيق. يتطلب تثبيت PWA وواجهات المتصفح ذات الصلة اتصالًا آمنًا عبر HTTPS.

Local data is **not encrypted by the app**. The focus timer relies on the device clock, and timer completion or notifications are not guaranteed while the app is closed. PWA installation and related browser APIs require a secure HTTPS connection.

## التقنية | Tech stack

React · TypeScript · Vite · Dexie · IndexedDB · Tailwind CSS · Vitest · Vite PWA

## المساهمة | Contributing

المساهمات مرحّب بها. شغّل الاختبارات وفحص التنسيق والبناء قبل إرسال التغييرات، واحرص على اتساق العربية والإنجليزية وسلامة تخزين البيانات المحلية.

Contributions are welcome. Run the tests, lint checks, and production build before submitting changes. Keep Arabic and English behavior consistent and preserve local data handling.
