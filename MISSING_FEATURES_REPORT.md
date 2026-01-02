# Missing Features Report: Old MERN vs Refactored Next.js

## 🔴 CRITICAL MISSING FEATURES

### 1. Dashboard Page
**Old Version Has:**
- Welcome message with user's first name
- Quick Actions section (Routine Lottery, Plan Meals, Browse Recipes buttons)
- Health Tips section with daily tip
- Recent Routines display (6 most recent)
- Statistics cards (routines count, recipes count)

**Current Version Has:**
- Basic user/household info cards only
- ❌ No quick actions
- ❌ No health tips
- ❌ No recent routines
- ❌ No statistics

### 2. Journal Analytics
**Old Version Has:**
- Full analytics dashboard with:
  - Average mood/energy/sleep calculations
  - Trend indicators (📈📉➡️)
  - Color-coded ratings
  - Multiple analytics cards
- Tab navigation: Calendar | Form | Analytics

**Current Version Has:**
- Basic calendar heatmap only
- ❌ No analytics dashboard
- ❌ No trend calculations
- ❌ No tab navigation

### 3. Journal Entry Detail View
**Old Version Has:**
- Clickable calendar dates
- Entry detail modal/page showing:
  - Full entry information
  - Mood/Energy/Sleep breakdown
  - Edit/Delete buttons
  - Formatted date display

**Current Version Has:**
- Basic calendar (not clickable)
- ❌ No entry detail view
- ❌ No edit/delete from calendar

### 4. Meal Plan Generation Form
**Old Version Has:**
- Full form to generate meal plans with:
  - Week start date picker
  - Dietary restrictions (multi-select)
  - Health goals (multi-select)
  - Cuisine preferences (multi-select)
  - Avoid ingredients list
  - Available recipe count display

**Current Version Has:**
- Drag-and-drop only
- ❌ No generation form
- ❌ No preference-based meal planning

### 5. Grocery List Features
**Old Version Has:**
- Check/uncheck items (with state persistence)
- Progress bar showing completion percentage
- Sort by name or category
- CSV export functionality
- Print functionality
- Grouped display by category

**Current Version Has:**
- Basic list display
- ❌ No checkboxes (non-functional)
- ❌ No progress tracking
- ❌ No sorting
- ❌ No export
- ❌ No category grouping

### 6. Recipe Create/Edit Form
**Old Version Has:**
- Full recipe creation form
- Edit existing recipes
- Form validation
- Ingredient/instruction management

**Current Version Has:**
- View only
- ❌ No create form
- ❌ No edit form
- ❌ Link to `/recipes/new` but page doesn't exist

### 7. Recipe Detail Page Actions
**Old Version Has:**
- Edit button on detail page
- Delete button on detail page
- Admin-only visibility

**Current Version Has:**
- View only
- ❌ No edit/delete buttons

## 📊 Feature Comparison Summary

| Feature | Old MERN | Refactored | Status |
|---------|----------|------------|--------|
| Dashboard Quick Actions | ✅ | ❌ | **MISSING** |
| Dashboard Health Tips | ✅ | ❌ | **MISSING** |
| Dashboard Statistics | ✅ | ❌ | **MISSING** |
| Journal Analytics | ✅ | ❌ | **MISSING** |
| Journal Entry Detail | ✅ | ❌ | **MISSING** |
| Interactive Calendar | ✅ | ❌ | **MISSING** |
| Meal Plan Form | ✅ | ❌ | **MISSING** |
| Grocery Checkboxes | ✅ | ❌ | **MISSING** |
| Grocery Progress Bar | ✅ | ❌ | **MISSING** |
| Grocery Export/Print | ✅ | ❌ | **MISSING** |
| Recipe Create Form | ✅ | ❌ | **MISSING** |
| Recipe Edit Form | ✅ | ❌ | **MISSING** |
| Recipe Detail Actions | ✅ | ❌ | **MISSING** |

## 🎯 Implementation Priority

1. **High Priority:**
   - Recipe Create/Edit Form (core functionality)
   - Grocery List interactive features (checkboxes, export)
   - Journal Entry Detail View (user experience)

2. **Medium Priority:**
   - Dashboard enhancements (quick actions, stats)
   - Journal Analytics
   - Meal Plan Generation Form

3. **Low Priority:**
   - Health Tips (can be static content)
   - Recent Routines (nice to have)

