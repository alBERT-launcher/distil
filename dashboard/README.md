# Distil Dashboard

A Streamlit-based dashboard for managing and curating LLM pipeline outputs from Distil.

## Features

- View all pipeline versions with detailed metadata
- Rate outputs (1-5 stars)
- Add and manage tags
- Mark versions as finetuned
- Analytics and visualizations
- Synthetic data generation interface
- Filter and search functionality

## Setup

1. Install requirements:
```bash
pip install -r requirements.txt
```

2. Configure environment:
Make sure your `.env` file is properly configured with:
```env
DASHBOARD_PORT=3000  # Should match your Distil API port
```

3. Run the dashboard:
```bash
streamlit run app.py
```

## Usage

The dashboard has three main tabs:

1. **Pipeline Versions**
   - View all versions with metadata
   - Rate and tag outputs
   - Mark versions as finetuned
   - Filter by rating and tags

2. **Analytics**
   - Rating distribution
   - Tag distribution
   - Version timeline

3. **Synthetic Data**
   - Generate new data from high-quality examples
   - Configure generation parameters

## Integration with Distil

The dashboard communicates with the Distil API endpoints:
- GET /dashboard/versions
- POST /dashboard/versions/:id/tag
- POST /dashboard/versions/:id/rate
- POST /dashboard/versions/:id/finetune
