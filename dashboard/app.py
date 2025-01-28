import streamlit as st
import pandas as pd
import plotly.express as px
from supabase import create_client
import os
from datetime import datetime, timedelta
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Set page config
st.set_page_config(
    page_title="Distil Dashboard",
    page_icon="🧪",
    layout="wide"
)

# Sidebar navigation
page = st.sidebar.selectbox(
    "Navigation",
    ["Datasets", "Models", "Marketplace", "Analytics"]
)

# Helper functions
def load_datasets():
    response = supabase.table("prompt_logs").select("*").execute()
    df = pd.DataFrame(response.data)
    return df

def load_models():
    response = supabase.table("models").select("*").execute()
    df = pd.DataFrame(response.data)
    return df

def update_entry(entry_id, updates):
    supabase.table("prompt_logs").update(updates).eq("id", entry_id).execute()

def toggle_model_status(model_id, active):
    supabase.table("models").update({"active": active}).eq("id", model_id).execute()

# Datasets page
if page == "Datasets":
    st.title("🗃️ Dataset Management")
    
    # Load datasets
    datasets_df = load_datasets()
    
    # Group by template
    templates = datasets_df.groupby("templateHash").agg({
        "id": "count",
        "rating": "mean"
    }).reset_index()
    templates.columns = ["Template Hash", "Entries", "Avg Rating"]
    
    # Display template list
    selected_template = st.selectbox(
        "Select Template",
        templates["Template Hash"],
        format_func=lambda x: f"Template {x[:8]} ({int(templates[templates['Template Hash']==x]['Entries'].values[0])} entries)"
    )
    
    # Display template entries
    if selected_template:
        entries = datasets_df[datasets_df["templateHash"] == selected_template]
        
        # Create tabs for different views
        tab1, tab2 = st.tabs(["Dataset Entries", "Statistics"])
        
        with tab1:
            for _, entry in entries.iterrows():
                with st.expander(f"Entry {entry['id'][:8]} - {entry['timestamp'][:10]}"):
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.text_area("Prompt", entry["prompt"], height=100)
                    
                    with col2:
                        # Make completion editable
                        new_completion = st.text_area(
                            "Completion",
                            entry["completion"],
                            height=100
                        )
                        if new_completion != entry["completion"]:
                            if st.button("Save Changes", key=f"save_{entry['id']}"):
                                update_entry(entry["id"], {"completion": new_completion})
                                st.success("Changes saved!")
                    
                    # Rating system
                    col3, col4 = st.columns(2)
                    with col3:
                        rating = st.slider(
                            "Rate this response",
                            1, 5,
                            value=int(entry.get("rating", 3)),
                            key=f"rating_{entry['id']}"
                        )
                        if rating != entry.get("rating"):
                            update_entry(entry["id"], {"rating": rating})
                    
                    with col4:
                        st.text(f"Cost: ${entry['usage']['costUSD']:.4f}")
                        st.text(f"Tokens: {entry['usage']['totalTokens']}")
        
        with tab2:
            col1, col2 = st.columns(2)
            
            with col1:
                # Rating distribution
                ratings = entries["rating"].value_counts()
                fig = px.bar(
                    x=ratings.index,
                    y=ratings.values,
                    title="Rating Distribution",
                    labels={"x": "Rating", "y": "Count"}
                )
                st.plotly_chart(fig)
            
            with col2:
                # Token usage over time
                fig = px.line(
                    entries,
                    x="timestamp",
                    y="usage.totalTokens",
                    title="Token Usage Over Time"
                )
                st.plotly_chart(fig)

# Models page
elif page == "Models":
    st.title("🤖 Model Management")
    
    models_df = load_models()
    
    # Display model list
    for _, model in models_df.iterrows():
        with st.expander(f"Model: {model['name']} ({model['id'][:8]})"):
            col1, col2 = st.columns(2)
            
            with col1:
                st.text(f"Base Model: {model['baseModel']}")
                st.text(f"Template: {model['templateHash'][:8]}")
                st.text(f"Created: {model['createdAt']}")
                
                # Toggle model active status
                is_active = st.toggle(
                    "Active",
                    model["active"],
                    key=f"toggle_{model['id']}"
                )
                if is_active != model["active"]:
                    toggle_model_status(model["id"], is_active)
            
            with col2:
                st.metric("Accuracy", f"{model['metrics']['accuracy']*100:.1f}%")
                st.metric("Avg Response Time", f"{model['metrics']['avgResponseTime']:.2f}s")
                st.metric("Cost per Token", f"${model['metrics']['costPerToken']:.5f}")
    
    # Create new fine-tuned model
    st.divider()
    st.subheader("Create New Fine-tuned Model")
    
    col1, col2 = st.columns(2)
    with col1:
        template_hash = st.selectbox(
            "Template Hash",
            datasets_df["templateHash"].unique()
        )
        
    with col2:
        base_model = st.selectbox(
            "Base Model",
            ["gpt-4o-mini", "gpt-4o"]
        )
    
    if st.button("Start Fine-tuning"):
        with st.spinner("Creating fine-tuning job..."):
            # Here you would implement the actual fine-tuning
            st.success("Fine-tuning job created! Check back later for results.")

# Marketplace page
elif page == "Marketplace":
    st.title("🏪 Model Marketplace")
    
    tab1, tab2 = st.tabs(["Browse Models", "My Published Models"])
    
    with tab1:
        # Search and filters
        col1, col2 = st.columns([3, 1])
        with col1:
            search = st.text_input("Search models", placeholder="e.g., 'React buttons'")
        with col2:
            min_rating = st.slider("Min Rating", 1, 5, 4)
        
        # Display marketplace models
        models_df = load_models()
        marketplace_models = models_df[models_df["marketplace.published"]]
        
        for _, model in marketplace_models.iterrows():
            with st.expander(f"{model['name']} - ${model['marketplace']['price']}/1k tokens"):
                col1, col2 = st.columns([3, 1])
                
                with col1:
                    st.markdown(f"**Description**: {model['marketplace']['description']}")
                    st.text(f"Tags: {', '.join(model['marketplace']['tags'])}")
                    st.text(f"Rating: {'⭐' * int(model['marketplace']['ratings'])}")
                
                with col2:
                    if st.button("Subscribe", key=f"sub_{model['id']}"):
                        st.success(f"API Key: sk-...{model['id'][-4:]}")
    
    with tab2:
        # Display user's published models
        my_models = models_df[
            (models_df["marketplace.published"]) & 
            (models_df["owner"] == "current_user")
        ]
        
        for _, model in my_models.iterrows():
            with st.expander(f"{model['name']} - Revenue: ${model['marketplace']['revenue']:.2f}"):
                col1, col2 = st.columns(2)
                
                with col1:
                    st.metric("Subscribers", model["marketplace"]["subscribers"])
                    st.metric("Avg. Daily Revenue", 
                             f"${model['marketplace']['revenue']/30:.2f}")
                
                with col2:
                    new_price = st.number_input(
                        "Price per 1k tokens",
                        value=model["marketplace"]["price"],
                        step=0.0001,
                        format="%.4f"
                    )
                    if new_price != model["marketplace"]["price"]:
                        if st.button("Update Price"):
                            # Update price in database
                            st.success("Price updated!")

# Analytics page
else:
    st.title("📊 Analytics")
    
    # Date range selector
    col1, col2 = st.columns(2)
    with col1:
        start_date = st.date_input(
            "Start Date",
            datetime.now() - timedelta(days=30)
        )
    with col2:
        end_date = st.date_input(
            "End Date",
            datetime.now()
        )
    
    # Load data
    data = load_datasets()
    models = load_models()
    
    # Filter by date range
    mask = (pd.to_datetime(data["timestamp"]).dt.date >= start_date) & \
           (pd.to_datetime(data["timestamp"]).dt.date <= end_date)
    filtered_data = data[mask]
    
    # Display metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Total Requests",
            len(filtered_data)
        )
    
    with col2:
        st.metric(
            "Total Cost",
            f"${filtered_data['usage'].apply(lambda x: x['costUSD']).sum():.2f}"
        )
    
    with col3:
        st.metric(
            "Avg Response Time",
            f"{filtered_data['usage'].apply(lambda x: x['durationMs']).mean()/1000:.2f}s"
        )
    
    with col4:
        st.metric(
            "Active Models",
            len(models[models["active"]])
        )
    
    # Charts
    col1, col2 = st.columns(2)
    
    with col1:
        # Requests over time
        daily_requests = filtered_data.groupby(
            pd.to_datetime(filtered_data["timestamp"]).dt.date
        ).size()
        
        fig = px.line(
            x=daily_requests.index,
            y=daily_requests.values,
            title="Requests per Day",
            labels={"x": "Date", "y": "Requests"}
        )
        st.plotly_chart(fig)
    
    with col2:
        # Cost over time
        daily_cost = filtered_data.groupby(
            pd.to_datetime(filtered_data["timestamp"]).dt.date
        )["usage"].apply(lambda x: sum(i["costUSD"] for i in x))
        
        fig = px.line(
            x=daily_cost.index,
            y=daily_cost.values,
            title="Cost per Day",
            labels={"x": "Date", "y": "Cost ($)"}
        )
        st.plotly_chart(fig)
    
    # Model performance comparison
    st.subheader("Model Performance")
    model_metrics = []
    for _, model in models.iterrows():
        model_metrics.append({
            "name": model["name"],
            "accuracy": model["metrics"]["accuracy"],
            "response_time": model["metrics"]["avgResponseTime"],
            "cost_per_token": model["metrics"]["costPerToken"]
        })
    
    metrics_df = pd.DataFrame(model_metrics)
    
    fig = px.scatter(
        metrics_df,
        x="response_time",
        y="accuracy",
        size="cost_per_token",
        hover_data=["name"],
        title="Model Performance Comparison"
    )
    st.plotly_chart(fig)
