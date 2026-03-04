"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

interface WikiImageProps {
  title: string;
  alt?: string;
}

export function WikiImage({ title, alt }: WikiImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWikiImage() {
      try {
        setLoading(true);
        // Replace underscores and format for Wikipedia search
        const query = encodeURIComponent(title.replace(/_/g, " "));
        const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${query}&prop=pageimages&format=json&pithumbsize=800&origin=*`);
        
        if (!res.ok) throw new Error("Network response was not ok");
        
        const data = await res.json();
        const pages = data.query?.pages;
        
        if (!pages) throw new Error("No pages in response");

        const pageId = Object.keys(pages)[0];
        if (pageId !== "-1" && pages[pageId].thumbnail?.source) {
          setSrc(pages[pageId].thumbnail.source);
        } else {
          // If no exact match thumbnail exists, try a generic search
          const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&prop=pageimages&format=json&pithumbsize=800&origin=*&gsrlimit=1`);
          const searchData = await searchRes.json();
          const searchPages = searchData.query?.pages;
          
          if (searchPages) {
            const firstSearchPageId = Object.keys(searchPages)[0];
            if (searchPages[firstSearchPageId].thumbnail?.source) {
              setSrc(searchPages[firstSearchPageId].thumbnail.source);
            } else {
              setError(true);
            }
          } else {
             setError(true);
          }
        }
      } catch (e) {
        console.error("Failed to fetch Wikipedia image for:", title, e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    if (title) {
      fetchWikiImage();
    }
  }, [title]);

  if (error) {
    return (
      <span className="flex flex-col items-center justify-center p-8 my-8 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500">
        <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-sm font-medium">Image unavailable: {title}</span>
      </span>
    );
  }

  if (loading || !src) {
    return <Skeleton className="w-full h-[300px] my-8 rounded-2xl" />;
  }

  return (
    <span className="block my-8 rounded-2xl overflow-hidden shadow-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
      <img 
        src={src} 
        alt={alt || title} 
        className="w-full h-auto max-h-[500px] object-cover" 
        loading="lazy" 
      />
    </span>
  );
}
