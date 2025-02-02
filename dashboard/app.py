import streamlit as st
import pandas as pd
import plotly.express as px
from elasticsearch import Elasticsearch
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Elasticsearch client
es = Elasticsearch(
    os.getenv('ELASTIC_HOST', 'http://localhost:9200'),
    basic_auth=(
        os.getenv('ELASTIC_USER', 'elastic'),
        os.getenv('ELASTIC_PASSWORD', 'changeme')
    )
)

# Page config must be the first Streamlit command
st.set_page_config(
    page_title="Distil Dashboard",
    page_icon="",
    layout="wide"
)

# Title and description
st.title("")
st.markdown("""
Manage and curate your LLM pipeline outputs. Rate, tag, and prepare data for fine-tuning.
""")

# Debug info in sidebar
st.sidebar.markdown("### Debug Info")
st.sidebar.text(f"Elasticsearch: {os.getenv('ELASTIC_HOST', 'http://localhost:9200')}")

# Function to fetch pipeline versions from Elasticsearch
@st.cache_data(ttl=30)
def fetch_pipelines():
    try:
        # Get all indices
        indices = es.cat.indices(format='json')
        pipeline_indices = [idx['index'] for idx in indices if not idx['index'].startswith('.')]
        
        pipelines = []
        for idx in pipeline_indices:
            # Get pipeline metadata
            result = es.search(
                index=idx,
                body={
                    'size': 0,
                    'aggs': {
                        'unique_pipelines': {
                            'terms': {
                                'field': 'pipelineHash.keyword',
                                'size': 1000
                            },
                            'aggs': {
                                'latest_doc': {
                                    'top_hits': {
                                        'size': 1,
                                        '_source': [
                                            'pipelineName',
                                            'pipelineHash',
                                            'template',
                                            'tags',
                                            'rating',
                                            'finetuned',
                                            '@timestamp'
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            )
            
            for bucket in result['aggregations']['unique_pipelines']['buckets']:
                pipeline = bucket['latest_doc']['hits']['hits'][0]['_source']
                pipeline['count'] = bucket['doc_count']
                pipeline['index'] = idx
                pipelines.append(pipeline)
        
        # Sort by timestamp if available, otherwise by count
        if pipelines and '@timestamp' in pipelines[0]:
            pipelines.sort(key=lambda x: x.get('@timestamp', ''), reverse=True)
        else:
            pipelines.sort(key=lambda x: x['count'], reverse=True)
        
        return pipelines
    except Exception as e:
        st.error(f"Error fetching pipelines: {str(e)}")
        return []

# Function to fetch completions for a pipeline
def fetch_completions(pipeline_hash, index):
    try:
        result = es.search(
            index=index,
            body={
                'size': 100,
                'query': {
                    'term': {
                        'pipelineHash.keyword': pipeline_hash
                    }
                },
                '_source': [
                    'pipelineName',
                    'pipelineHash',
                    'input',
                    'output',
                    'parameters',
                    'cost',
                    'rating',
                    'tags',
                    'finetuned',
                    '@timestamp'
                ]
            }
        )
        
        completions = []
        for hit in result['hits']['hits']:
            completion = hit['_source']
            completion['_id'] = hit['_id']
            completion['index'] = index
            completions.append(completion)
        
        # Sort by timestamp if available, otherwise by _id
        if completions and '@timestamp' in completions[0]:
            completions.sort(key=lambda x: x.get('@timestamp', ''), reverse=True)
        else:
            completions.sort(key=lambda x: x['_id'], reverse=True)
        
        return completions
    except Exception as e:
        st.error(f"Error fetching completions: {str(e)}")
        return []

# Function to add tag
def add_tag(doc_id, tag, index):
    if not tag:
        st.error("Tag cannot be empty")
        return False
    try:
        result = es.update(
            index=index,
            id=doc_id,
            body={
                'script': {
                    'source': '''
                    if (!ctx._source.containsKey("tags")) {
                        ctx._source.tags = [];
                    }
                    if (!ctx._source.tags.contains(params.tag)) {
                        ctx._source.tags.add(params.tag);
                    }
                ''',
                    'params': {'tag': tag}
                }
            }
        )
        st.success(f"Added tag '{tag}'")
        return True
    except Exception as e:
        st.error(f"Error adding tag: {str(e)}")
        return False

# Function to rate version
def rate_completion(doc_id, rating, index):
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        st.error("Rating must be between 1 and 5")
        return False
    try:
        result = es.update(
            index=index,
            id=doc_id,
            body={
                'doc': {
                    'rating': rating
                }
            }
        )
        st.success(f"Rated completion with {rating} stars")
        return True
    except Exception as e:
        st.error(f"Error rating completion: {str(e)}")
        return False

# Function to mark as finetuned
def mark_finetuned(doc_id, index):
    try:
        result = es.update(
            index=index,
            id=doc_id,
            body={
                'doc': {
                    'finetuned': True
                }
            }
        )
        st.success(f"Marked as finetuned")
        return True
    except Exception as e:
        st.error(f"Error marking as finetuned: {str(e)}")
        return False

# Sidebar for filters
st.sidebar.header("Filters")
rating_filter = st.sidebar.slider("Minimum Rating", 1, 5, 1)
show_finetuned = st.sidebar.checkbox("Show Finetuned", True)
search_query = st.sidebar.text_input("Search Tags")

# Main content
tab1, tab2 = st.tabs(["Pipelines", "Analytics"])

with tab1:
    # Force refresh button
    col1, col2 = st.columns([1, 4])
    with col1:
        if st.button("🔄 Refresh"):
            st.cache_data.clear()
            st.rerun()
    with col2:
        st.markdown("Click refresh to fetch the latest pipelines")

    # Fetch and display pipelines
    pipelines = fetch_pipelines()
    
    if not pipelines:
        st.warning("No pipelines found")
    else:
        # Convert to DataFrame for easier filtering
        df = pd.DataFrame(pipelines)
        
        # Apply filters
        if not show_finetuned:
            df = df[~df['finetuned']]
        if search_query:
            df = df[df['tags'].apply(lambda x: search_query.lower() in ' '.join(x).lower() if x else False)]
        if rating_filter > 1:
            df = df[df['rating'] >= rating_filter]
        
        # Sort by timestamp (newest first)
        if '@timestamp' in df.columns:
            df['@timestamp'] = pd.to_datetime(df['@timestamp'])
            df = df.sort_values('@timestamp', ascending=False)
        
        # Display pipelines
        for _, pipeline in df.iterrows():
            rating = pipeline.get('rating')
            rating_display = "★" * (int(rating) if pd.notna(rating) and rating is not None else 0)
            tags_display = ', '.join(pipeline.get('tags', [])) if pipeline.get('tags') else 'No tags'
            
            with st.expander(
                f"Pipeline: {pipeline['pipelineName']} ({pipeline['count']} completions) | "
                f"Hash: {pipeline['pipelineHash'][:8]} | "
                f"Rating: {rating_display} | Tags: {tags_display}"
            ):
                # Get completions for this pipeline
                completions = fetch_completions(pipeline['pipelineHash'], pipeline['index'])
                
                if not completions:
                    st.warning("No completions found for this pipeline")
                else:
                    for completion in completions:
                        st.markdown("---")
                        col1, col2 = st.columns([3, 1])
                        
                        with col1:
                            # Input/Output
                            if completion.get('input'):
                                st.markdown("**Input:**")
                                st.text(completion['input'])
                            
                            if completion.get('output'):
                                st.markdown("**Output:**")
                                st.text(completion['output'])
                            
                            if completion.get('parameters'):
                                st.markdown("**Parameters:**")
                                params = completion['parameters']
                                if isinstance(params, dict):
                                    for key, value in params.items():
                                        # Create a label with the key name
                                        st.text_input(key, value, key=f"param_{completion['_id']}_{key}", disabled=True)
                                else:
                                    st.text_input("Raw Parameters", str(params), disabled=True)
                            
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                if completion.get('cost') is not None:
                                    st.write(f"Cost: ${completion['cost']:.4f}")
                            with col2:
                                if completion.get('@timestamp'):
                                    st.write(f"Created: {completion['@timestamp']}")
                            with col3:
                                if completion.get('finetuned'):
                                    st.write("🎯 Finetuned")
                        
                        with col2:
                            # Rating widget
                            current_rating = completion.get('rating', 1)
                            new_rating = st.select_slider(
                                "Rate",
                                options=[1, 2, 3, 4, 5],
                                value=current_rating,
                                key=f"rate_{completion['_id']}"
                            )
                            if new_rating != current_rating:
                                if rate_completion(completion['_id'], new_rating, completion['index']):
                                    st.rerun()
                            
                            # Tag input
                            new_tag = st.text_input("Add Tag", key=f"tag_{completion['_id']}")
                            if st.button("Add Tag", key=f"add_tag_{completion['_id']}"):
                                if add_tag(completion['_id'], new_tag, completion['index']):
                                    st.rerun()
                            
                            # Current tags
                            st.subheader("Current Tags")
                            for tag in (completion.get('tags') or []):
                                st.text(f"• {tag}")
                            
                            # Finetune button
                            if not completion.get('finetuned'):
                                if st.button("Mark as Finetuned", key=f"finetune_{completion['_id']}"):
                                    if mark_finetuned(completion['_id'], completion['index']):
                                        st.rerun()

with tab2:
    pipelines = fetch_pipelines()
    if pipelines:
        df = pd.DataFrame(pipelines)
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Rating distribution
            if 'rating' in df.columns:
                rating_data = df[df['rating'].notna()]
                if not rating_data.empty:
                    fig1 = px.histogram(
                        rating_data,
                        x="rating",
                        title="Rating Distribution",
                        labels={"rating": "Rating", "count": "Number of Pipelines"},
                        nbins=5
                    )
                    st.plotly_chart(fig1)
                else:
                    st.info("No ratings yet")
            else:
                st.info("No ratings yet")
        
        with col2:
            # Tag distribution
            if 'tags' in df.columns:
                all_tags = [tag for tags in df['tags'] for tag in (tags or [])]
                if all_tags:
                    tag_counts = pd.Series(all_tags).value_counts()
                    fig2 = px.bar(
                        x=tag_counts.index,
                        y=tag_counts.values,
                        title="Tag Distribution",
                        labels={"x": "Tag", "y": "Count"}
                    )
                    st.plotly_chart(fig2)
                else:
                    st.info("No tags yet")
            else:
                st.info("No tags yet")
        
        # Usage timeline
        if 'count' in df.columns:
            if '@timestamp' in df.columns:
                x_axis = pd.to_datetime(df['@timestamp'])
                x_label = "Time"
            else:
                x_axis = range(len(df))
                x_label = "Pipeline Index"
            
            fig3 = px.scatter(
                x=x_axis,
                y=df['count'],
                size=df['count'],
                color=df['pipelineName'],
                hover_data={'pipelineHash': df['pipelineHash']},
                title="Pipeline Usage",
                labels={'x': x_label, 'y': 'Number of Completions', 'color': 'Pipeline'}
            )
            st.plotly_chart(fig3)
        else:
            st.info("No usage data available")
