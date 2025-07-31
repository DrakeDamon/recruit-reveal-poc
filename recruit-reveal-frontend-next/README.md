# Recruit Reveal Frontend

A cutting-edge high school football recruiting evaluation platform focused on athleticism, performance, and college fit.

## 🎨 Brand Identity

### Brand Personality

- **Bold & Athletic**: Conveying strength, energy, and clarity
- **Modern & Clean**: Minimalistic layouts with ample white space
- **Trustworthy & Professional**: Crisp typography and consistent color usage
- **Engaging & Dynamic**: Subtle animations and interactive UI elements

### Brand Colors

- **Primary Navy Blue**: `#1D2D50` - Represents strength and professionalism
- **Primary Turquoise**: `#00B7C2` - Represents energy and innovation
- **Gradients**: Linear gradients combining navy and turquoise for visual impact

### Typography

- **Brand Headers**: Bebas Neue (via Google Fonts) - Bold, athletic feel
- **Body Text**: Inter (via Google Fonts) - Excellent readability and accessibility
- **Fallbacks**: Oswald, Montserrat for headers; Poppins for body text

## 🏗️ Architecture

### Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom CSS variables
- **Animations**: Framer Motion for declarative animations
- **UI Components**: Ant Design with custom brand styling
- **State Management**: React Context for dark mode and form state
- **Forms**: React Hook Form with Ant Design integration

### File Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── login/page.tsx      # Brand-styled login page
│   │   └── signup/page.tsx     # Brand-styled signup page
│   ├── wizard/
│   │   └── page.tsx            # Multi-step evaluation wizard
│   ├── layout.tsx              # Root layout with brand fonts
│   └── globals.css             # Brand colors and styling
├── components/
│   ├── Dashboard.tsx           # Evaluation results dashboard
│   ├── ChatThread.tsx          # Animated chat interface
│   ├── ProgressPills.tsx       # Animated progress indicators
│   ├── InputBar.tsx            # Dynamic form inputs
│   └── DarkModeContext.tsx     # Dark mode state management
```

## 🎭 Animation Implementation

### Framer Motion Usage

All animations use Framer Motion for performance and consistency:

```typescript
// Example: Staggered card animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
```

### Animation Types

1. **Page Transitions**: Fade-in with scale effects
2. **Chat Messages**: Staggered slide-in with bubble animations
3. **Progress Indicators**: Animated fill bars and pill transitions
4. **Form Interactions**: Hover effects and focus animations
5. **Dashboard Cards**: Staggered entrance animations

### Performance Considerations

- Uses `AnimatePresence` for smooth enter/exit animations
- Implements `prefers-reduced-motion` for accessibility
- Optimized with `transform` and `opacity` properties
- Staggered animations prevent overwhelming users

## 🎨 UX Design Decisions

### Color System

```css
:root {
  --brand-navy: #1d2d50;
  --brand-turquoise: #00b7c2;
  --gradient-primary: linear-gradient(
    135deg,
    var(--brand-navy) 0%,
    var(--brand-turquoise) 100%
  );
}
```

### Dark Mode Implementation

- CSS variables for seamless theme switching
- Persistent preference storage
- Consistent brand colors across themes
- Smooth transitions between modes

### Responsive Design

- Mobile-first approach with Tailwind breakpoints
- Flexible card layouts using Ant Design Grid
- Touch-friendly interactive elements
- Optimized typography scaling

### Accessibility Features

- High contrast ratios for brand colors
- Keyboard navigation support
- Screen reader friendly markup
- Reduced motion support
- Semantic HTML structure

## 🚀 Key Features

### Multi-Step Wizard

- **Dynamic Form Generation**: Position-specific questions (QB, RB, WR)
- **Chat-like Interface**: Message bubbles with brand styling
- **Progress Tracking**: Animated pills with completion indicators
- **Real-time Validation**: Inline error handling and feedback

### Dashboard

- **Brand Header**: Gradient background with animated title
- **Score Visualization**: Animated progress circles and charts
- **Expandable Goals**: Interactive goal management
- **Recruiting Calendar**: Timeline with color-coded periods
- **Share Functionality**: Social media integration

### Authentication

- **Brand-styled Forms**: Consistent with overall design
- **Smooth Transitions**: Page-to-page animations
- **Error Handling**: User-friendly validation messages
- **Dark Mode Support**: Seamless theme switching

## 🛠️ Development

### Getting Started

```bash
npm install
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Brand Implementation Notes

- All components use CSS custom properties for brand colors
- Animations are declarative and performance-optimized
- Dark mode is implemented at the CSS variable level
- Typography scales responsively across devices

### Customization

- Brand colors can be modified in `globals.css`
- Animation timing can be adjusted in component variants
- Font families can be changed in `layout.tsx`
- Component styling uses Tailwind with custom classes

## 📱 Mobile Optimization

- Touch-friendly button sizes (44px minimum)
- Swipe gestures for navigation
- Optimized chat interface for mobile
- Responsive progress indicators
- Mobile-first form design

## 🎯 Performance

- Font loading optimized with `display: swap`
- Lazy loading for non-critical components
- Optimized animations using `transform` properties
- Minimal bundle size with tree shaking
- Efficient re-renders with React.memo where appropriate
