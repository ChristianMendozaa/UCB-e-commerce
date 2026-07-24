-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the table to store the RAG chunks (documents and products)
create table if not exists rag_ucbcommerce_chunks (
  id bigserial primary key,
  source_id uuid not null,                    -- ID of the original document or product (UUID v4 or v5)
  chunk_index integer not null,               -- Index of the chunk within the document
  text text not null,                         -- The text content of the chunk
  embedding vector(1536)                      -- OpenAI text-embedding-3-small has 1536 dimensions
);

-- Create an HNSW index for faster similarity search
-- Note: You might need to adjust 'm' and 'ef_construction' based on your dataset size
create index on rag_ucbcommerce_chunks using hnsw (embedding vector_cosine_ops);

-- Create the function to match similar documents
-- This function is called by the chatbot to find relevant context
create or replace function match_rag_ucbcommerce_chunks (
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_source uuid DEFAULT null
) returns table (
  id bigint,
  source_id uuid,
  chunk_index int,
  text text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    rag_ucbcommerce_chunks.id,
    rag_ucbcommerce_chunks.source_id,
    rag_ucbcommerce_chunks.chunk_index,
    rag_ucbcommerce_chunks.text,
    1 - (rag_ucbcommerce_chunks.embedding <=> query_embedding) as similarity
  from rag_ucbcommerce_chunks
  where 1 - (rag_ucbcommerce_chunks.embedding <=> query_embedding) > 0.5 -- Optional threshold
  and (filter_source is null or rag_ucbcommerce_chunks.source_id = filter_source)
  order by rag_ucbcommerce_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
