-- Update the matching function with a lower threshold (0.3 instead of 0.5)
-- This allows more results to be returned even if the similarity is not perfect.

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
  where 1 - (rag_ucbcommerce_chunks.embedding <=> query_embedding) > 0.3 -- LOWERED THRESHOLD
  and (filter_source is null or rag_ucbcommerce_chunks.source_id = filter_source)
  order by rag_ucbcommerce_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
