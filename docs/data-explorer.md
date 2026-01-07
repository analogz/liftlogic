# LiftLogic Data Explorer

## Overview
The Data Explorer is a comprehensive tool for exploring, editing, and managing your workout tracker datasets. It's specifically designed to handle corrupted data issues that might prevent the Dashboard from loading properly.

## 🚨 **Solving Dashboard Loading Issues**

If your Dashboard won't load due to corrupted data, follow these steps:

### Step 1: Open the Data Explorer
- Navigate to `data-explorer.html` in your browser
- Select your user profile from the dropdown

### Step 2: Identify the Problem
- Look at the **Data Issues** panel on the right side
- This will show you exactly what's wrong with your data
- Common issues include:
  - Missing dates
  - Invalid date formats  
  - Missing exercise data
  - Duplicate workouts
  - Negative values

### Step 3: Find the Corrupted Workout
- Use the **Search & Filter** section to narrow down problematic workouts
- Look for workouts with red status indicators (⭕ Error)
- Yellow indicators (⚠️ Warning) are less critical but should be addressed

### Step 4: Fix the Data
- Click **Edit** on the problematic workout
- You'll see the workout data in JSON format
- Common fixes:
  - **Missing date**: Add `"currentDate": "2024-01-15"` (use correct format)
  - **Invalid exercise**: Ensure each exercise has a `"kind"` field with the exercise name
  - **Missing sets**: Add sets data or weight/reps for each exercise
- Click **Validate JSON** to check your changes
- Click **Save Changes** when ready

### Step 5: Verify the Fix
- Return to the main Data Explorer page
- Click **Validate Data** to re-check all data
- When no critical errors remain, try loading the Dashboard again

## 🔧 **Key Features**

### Data Management Tools
- **Create Backup**: Download complete data backup before making changes
- **Restore Data**: Upload and restore from backup files
- **Validate Data**: Check for corruption and integrity issues
- **Export CSV**: Export data for external analysis
- **Cleanup Data**: Automatically remove duplicates and fix common issues
- **Bulk Editor**: Edit multiple workouts simultaneously

### Search & Filter
- **Text Search**: Search through all workout data
- **Date Range**: Filter by specific date ranges
- **Exercise Filter**: Show workouts containing specific exercises
- **Status Filter**: Show only healthy, warning, or error workouts

### Data Overview
- **Statistics**: Total workouts, exercises, date range, data size
- **Health Status**: Overall data integrity assessment
- **Issue Detection**: Detailed list of all data problems

## 🛡️ **Safety Features**

### Before Making Changes
1. **Always create a backup first** using the "Create Backup" tool
2. **Use validation** before saving any changes
3. **Test with a copy** if you're unsure about changes

### Data Validation
The tool automatically checks for:
- Required fields (dates, exercise names)
- Valid date formats
- Positive numeric values
- Proper data structure
- Duplicate entries

### Error Recovery
- **Reset to Original**: Undo changes in the editor
- **Restore from Backup**: Revert all changes from backup file
- **Validation Messages**: Clear error descriptions and solutions

## 📊 **Understanding Status Indicators**

- 🟢 **Green (Healthy)**: No issues detected
- 🟡 **Yellow (Warning)**: Minor issues that won't break functionality
- 🔴 **Red (Error)**: Critical issues that may cause Dashboard failures

## 🔧 **Common Corruption Scenarios**

### Scenario 1: "Dashboard won't load at all"
**Likely cause**: Critical data structure issue
**Solution**: Look for red error indicators, check for missing `dailyInfo` or `exercises` arrays

### Scenario 2: "Dashboard loads but shows errors"
**Likely cause**: Invalid dates or missing required fields
**Solution**: Check date formats, ensure all required daily info fields are present

### Scenario 3: "Some workouts don't appear in analytics"
**Likely cause**: Malformed exercise data or missing exercise names
**Solution**: Ensure each exercise has a `kind` field with a valid name

### Scenario 4: "Duplicate data appearing"
**Likely cause**: Multiple workouts with the same date
**Solution**: Use the "Cleanup Data" tool to automatically remove duplicates

## 📝 **Quick Fix Checklist**

For each problematic workout, verify:
- [ ] Has `dailyInfo` section
- [ ] Has valid `currentDate` in YYYY-MM-DD format
- [ ] Has `currentTime` in HH:MM format
- [ ] Has `exercises` array (even if empty)
- [ ] Each exercise has `kind` field with exercise name
- [ ] Numeric values are positive (weight, reps, etc.)
- [ ] No duplicate dates (unless multiple sessions per day)

## 🚀 **Quick Start for Your Issue**

Since you mentioned corrupted data preventing Dashboard loading:

1. **Open data-explorer.html**
2. **Check "Data Issues" panel** - this will immediately show what's wrong
3. **Look for red error status** workouts in the list
4. **Create a backup first** (just in case)
5. **Edit the problematic workout(s)** and fix the JSON
6. **Validate the fix** before saving
7. **Test the Dashboard** - it should now load properly

## 💡 **Pro Tips**

- **Use Ctrl+S** to save quickly in the editor
- **Use Ctrl+F** to search within workout JSON
- **The JSON editor shows line numbers** to help locate issues
- **Start with the oldest error** - it might cascade to others
- **Use bulk editor** for fixing multiple workouts with similar issues

## 🆘 **Need Help?**

If you're still having issues after using this tool:
1. Export your data to CSV for external analysis
2. Create a backup and share the specific error messages
3. Check the browser console (F12) for additional error details
4. Try the "Cleanup Data" automatic fix tool

The Data Explorer is designed to be your safety net for workout data management - use it confidently to keep your fitness tracking reliable and accurate! 