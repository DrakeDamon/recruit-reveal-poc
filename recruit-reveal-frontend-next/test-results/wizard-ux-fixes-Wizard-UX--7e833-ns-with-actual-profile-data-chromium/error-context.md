# Page snapshot

```yaml
- navigation:
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "Log In":
        - /url: /auth/login
    - listitem:
      - link "Sign Up":
        - /url: /auth/signup
- main:
  - heading "Recruit Reveal" [level=2]
  - button "Dark Mode"
  - text: "50% 1 🏈 Welcome! Ready to evaluate your potential? Recruit Reveal AI Step: 0, Steps length: 2, Current step key: Player_Name Name :"
  - textbox "Enter your name"
  - button "Next"
- alert
- dialog "Complete Your Profile":
  - text: Complete Your Profile
  - paragraph: Welcome to Recruit Reveal! Let's set up your profile to get started.
  - text: Your Full Name
  - textbox "Your Full Name"
  - text: Primary Position
  - combobox "Primary Position"
  - text: Select your position
  - button "Complete Setup"
```