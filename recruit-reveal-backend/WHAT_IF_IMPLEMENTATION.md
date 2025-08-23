# What-If Feature Implementation Summary

## ✅ Successfully Implemented

### Backend Implementation (`src/routes/predict.js`)

**New Dependencies & Configuration:**
- Uses Node.js built-in `fetch` (Node 20.19.4+ compatible)
- Added Databricks serving endpoint configuration using existing env vars
- Implemented class mapping for division predictions: `{0: 'D3/NAIA', 2: 'D2', 3: 'FCS', 4: 'Power 5'}`

**New Endpoints Added:**

1. **GET `/api/predict/whatif/:pos/sliders`**
   - Returns position-specific slider configurations
   - Supports QB, RB, WR positions
   - Includes min/max ranges, step sizes, and improvement directions

2. **POST `/api/predict/whatif/:pos`**
   - Performs binary search to find minimal stat changes
   - Supports both probability and class prediction responses
   - Returns smallest delta change recommendation

**Key Features:**
- **Schema Introspection**: Automatically fetches model input schema from Databricks API
- **Input Padding**: Pads missing fields with null values to match model requirements
- **Binary Search Algorithm**: Efficiently finds minimal changes needed for target division
- **Dual Response Handling**: Works with both `[classId]` and `[[probabilities]]` responses

**Position-Specific Sliders:**
- **QB**: 40-yard dash (4.4-5.4s), Senior YPG (50-500), Senior TD Passes (0-70), Vertical Jump (20-45")
- **RB**: 40-yard dash (4.3-5.2s), Senior YPG (20-350), Senior TD (0-40), Vertical Jump (24-44") 
- **WR**: 40-yard dash (4.3-5.2s), Senior Rec Yards (100-2500), Senior Rec TD (0-40), Vertical Jump (24-44")

### Frontend Implementation (`src/hooks/useWhatIf.ts`)

**React Hook Features:**
- TypeScript interfaces for type safety
- Debounced API calls (350ms) for smooth interaction
- Automatic slider fetching when position changes
- Error handling and loading states
- Uses existing `NEXT_PUBLIC_API_BASE` configuration

**Helper Functions:**
- `formatSliderValue()`: Context-aware value formatting
- `getSliderColor()`: Color-coding based on performance direction
- `formatRecommendation()`: Human-readable recommendation text

### Environment Configuration

**Updated `.env.example` with Databricks variables:**
```bash
DATABRICKS_HOST=https://your-workspace.azuredatabricks.net
DATABRICKS_MODEL_QB_URL=https://your-workspace.azuredatabricks.net/serving-endpoints/your-qb-endpoint/invocations
DATABRICKS_MODEL_RB_URL=https://your-workspace.azuredatabricks.net/serving-endpoints/your-rb-endpoint/invocations  
DATABRICKS_MODEL_WR_URL=https://your-workspace.azuredatabricks.net/serving-endpoints/your-wr-endpoint/invocations
DATABRICKS_TOKEN=your-databricks-personal-access-token
```

**Docker Compose**: Already configured to pass environment variables via `env_file`

## ✅ Testing Results

### Backend Endpoints Verified:
- `GET /api/health` ✅
- `GET /api/predict/_alive` ✅  
- `GET /api/predict/whatif/QB/sliders` ✅
- `GET /api/predict/whatif/RB/sliders` ✅
- `POST /api/predict/whatif/:pos` ✅ (accepts requests, requires live model endpoints for full testing)

### API Response Examples:

**Sliders Endpoint:**
```json
{
  "position": "RB",
  "sliders": [
    {
      "key": "Forty_Yard_Dash",
      "label": "40-yard (s)", 
      "min": 4.3,
      "max": 5.2,
      "step": 0.01,
      "direction": "lower_better"
    }
  ]
}
```

**What-If Prediction:**
```json
{
  "position": "RB",
  "target_label": "FCS", 
  "threshold": 0.5,
  "recommendation": {
    "field": "Senior_YPG",
    "from": 150,
    "to": 220,
    "delta": 70,
    "division_id": 3,
    "division_label": "FCS"
  }
}
```

## 🚀 Integration Ready

The implementation follows the exact specifications provided:
- ✅ Extends existing `/api/predict` router (no new routers created)
- ✅ Uses existing environment variable patterns
- ✅ Supports both class and probability model responses  
- ✅ Includes schema introspection and input padding
- ✅ Frontend hook uses established API patterns
- ✅ All existing endpoints preserved and functional

## 🎯 Next Steps

1. **Frontend Integration**: Add the useWhatIf hook to the wizard review step
2. **Live Testing**: Test with actual Databricks model endpoints for full functionality
3. **UI Enhancement**: Create slider components using the provided hook and helpers
4. **Error Handling**: Enhance error messages for better user experience

## 📝 Sample Frontend Integration

```tsx
import { useWhatIf } from '@/hooks/useWhatIf';

const { sliders, rec, loading, error, run } = useWhatIf('QB', formData);

// In review step:
{sliders.map(slider => (
  <div key={slider.key}>
    <label>{slider.label}</label>
    <input
      type="range"
      min={slider.min}
      max={slider.max} 
      step={slider.step}
      onChange={(e) => run('FCS', 0.5, [slider.key])}
    />
    {rec?.recommendation?.field === slider.key && (
      <div>Suggestion: {formatRecommendation(rec.recommendation)}</div>
    )}
  </div>
))}
```

The What-If feature is now ready for end-to-end testing and integration!