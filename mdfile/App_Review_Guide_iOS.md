# 🍏 Apple App Review Guide & Demo Instructions
**App Name**: MyReDesign (마이 리디자인)  
**Bundle ID**: `com.calamus.myredesign`  
**Target Platform**: iOS  
**Version**: 1.0.0  
**Developer**: CHANG WOO JUNG  
**Support URL**: https://myredesign.ai.kr/  

---

## 📌 Executive Summary
**MyReDesign** is an AI-powered lifestyle habit OS designed to help users establish sustainable daily routines. Through personalized AI mission generation, multimedia proof tracking, growth analytics, and buddy challenges, users design and elevate their daily lives.

---

## 🔑 Test Accounts & Demo Access

| Mode | Credentials | Instructions |
|---|---|---|
| **Guest / 7-Day Demo** | No login required | Tap **"로그인 없이 바로 시작하기"** on the initial screen to immediately experience the full loop without entering credentials. |
| **Member Full Access** | Use credentials provided in App Review Information | Log in with the test email & password to test full member features including cloud sync, history movie generation, and buddy challenges. |

---

## 🛠️ Step-by-Step Feature Walkthrough for Reviewer

```
[Screen 1: Welcome & Onboarding]
   ├── Guest Mode (7-day trial flow with goal setup)
   └── Member Mode (Kakao / Email Login)
          │
[Screen 2: Today (Main Mission Tab)]
   ├── AI Mission Generation: Daily 3 customized missions based on current mood & condition
   ├── Mission Verification: Multi-type proofs (Photo, Video, Audio, Text)
   └── AI Daily Reflection: End-of-day habit recap & coaching feedback
          │
[Screen 3: Growth Dashboard]
   ├── Real-time streaks, weekly completion rates, level-up milestones
   └── Trophy room & past reflections archive
          │
[Screen 4: History & PlayMovie]
   ├── Timeline of all completed missions
   └── PlayMovie: Auto-generated short-form motion recap video
          │
[Screen 5: Friends & Buddy Challenge]
   ├── 1:1 Buddy Challenge requests & acceptance
   └── Real-time completion progress tracking & cheering nudges
```

---

## 🛡️ Privacy, AI Safety & Guideline Compliance

1. **AI Safety (Guideline 1.2 / 5.1)**:
   - Mission generation utilizes OpenAI APIs with strictly bounded prompts tailored strictly to positive daily wellness goals (Body, Mind, Career Growth, FunPlay).
   - Inappropriate or harmful prompts are automatically filtered.

2. **User Data & Content Isolation**:
   - User proofs (photos/videos) are secured via Supabase Storage with strict Row Level Security (RLS).
   - Users have full control to edit or delete their verification proofs at any time.

3. **Account Deletion (Guideline 5.1.1(v))**:
   - Users can instantly delete their account and associated data directly within the app via **MyLoop ➡️ Account Settings ➡️ Delete Account**.

---

## 📞 Reviewer Support Contact
If you encounter any issues during the review process, please reach out directly:
- **Email**: changwoojung7@gmail.com
- **Website**: https://myredesign.ai.kr/
