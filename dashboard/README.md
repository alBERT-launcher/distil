# Distil Dashboard

A Streamlit-based dashboard for managing your AI models, datasets, and marketplace.

## Features

- 📊 Dataset Management
  - View and edit prompt-completion pairs
  - Rate responses
  - Track usage statistics

- 🤖 Model Management
  - Toggle between fine-tuned and base models
  - Create new fine-tuning jobs
  - Monitor model performance

- 🏪 Marketplace
  - Browse available models
  - Publish your models
  - Track revenue and subscribers

- 📈 Analytics
  - Usage statistics
  - Cost tracking
  - Performance metrics

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Run the dashboard:
   ```bash
   streamlit run app.py
   ```

## Usage

### Dataset Management
- Select a template to view its entries
- Edit completions directly in the interface
- Rate responses from 1-5 stars
- View statistics and visualizations

### Model Management
- Toggle models on/off to control routing
- Create new fine-tuned models from existing templates
- Monitor model performance metrics

### Marketplace
- Browse available models
- Subscribe to models you want to use
- Publish your own models and set pricing
- Track revenue and subscriber metrics

### Analytics
- View usage trends
- Monitor costs
- Compare model performance
- Track marketplace revenue
