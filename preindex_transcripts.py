#!/usr/bin/env python3
"""
Transcript Preindexing Script for Medical Medium Archive Tool
Creates a searchable index of all video transcripts for fast client-side search.
"""

import json
import os
import re
from collections import defaultdict
from pathlib import Path
import time

class TranscriptIndexer:
    def __init__(self, data_dir="data"):
        self.data_dir = Path(data_dir)
        self.subtitles_dir = self.data_dir / "subtitles"
        self.transcript_index = {}
        self.word_index = defaultdict(set)
        self.stats = {
            'total_files': 0,
            'processed_files': 0,
            'total_words': 0,
            'unique_words': 0,
            'total_size': 0
        }
    
    def extract_video_id_from_filename(self, filename):
        """Extract video ID from transcript filename"""
        # Handle various filename patterns
        patterns = [
            r'([a-zA-Z0-9_-]{11})_[a-z]{2}_auto\.txt$',  # Standard pattern
            r'([a-zA-Z0-9_-]{11})\.txt$',               # Simple pattern
            r'_([a-zA-Z0-9_-]{11})_[a-z]{2}_auto\.txt$' # Pattern with prefix
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                return match.group(1)
        
        return None
    
    def clean_text(self, text):
        """Clean transcript text for better search"""
        # Remove timestamp patterns like [00:01:23]
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', text)
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def extract_excerpts(self, text, max_excerpts=5, excerpt_length=200):
        """Extract meaningful excerpts from transcript"""
        sentences = re.split(r'[.!?]+', text)
        excerpts = []
        
        current_excerpt = ""
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            if len(current_excerpt + sentence) <= excerpt_length:
                current_excerpt += sentence + ". "
            else:
                if current_excerpt.strip():
                    excerpts.append(current_excerpt.strip())
                current_excerpt = sentence + ". "
                
            if len(excerpts) >= max_excerpts:
                break
        
        # Add the last excerpt if it exists
        if current_excerpt.strip() and len(excerpts) < max_excerpts:
            excerpts.append(current_excerpt.strip())
        
        return excerpts
    
    def build_word_index(self, video_id, text):
        """Build word-position index for fast searching"""
        words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
        word_positions = defaultdict(list)
        
        for i, word in enumerate(words):
            if len(word) >= 3:  # Index words 3+ characters
                word_positions[word].append(i)
                self.word_index[word].add(video_id)
        
        return dict(word_positions)
    
    def process_transcript_file(self, filepath):
        """Process a single transcript file"""
        # Skip macOS system files
        if filepath.name.startswith('._'):
            return False
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            video_id = self.extract_video_id_from_filename(filepath.name)
            if not video_id:
                print(f"Warning: Could not extract video ID from {filepath.name}")
                return False
            
            # Clean the transcript text
            cleaned_text = self.clean_text(content)
            
            # Build word index
            word_positions = self.build_word_index(video_id, cleaned_text)
            
            # Extract excerpts
            excerpts = self.extract_excerpts(cleaned_text)
            
            # Store in index
            self.transcript_index[video_id] = {
                'text': cleaned_text,
                'word_positions': word_positions,
                'excerpts': excerpts,
                'file_size': len(content),
                'word_count': len(cleaned_text.split())
            }
            
            # Update stats
            self.stats['processed_files'] += 1
            self.stats['total_words'] += len(cleaned_text.split())
            self.stats['total_size'] += len(content)
            
            return True
            
        except Exception as e:
            print(f"Error processing {filepath}: {e}")
            return False
    
    def process_all_transcripts(self):
        """Process all transcript files"""
        if not self.subtitles_dir.exists():
            print(f"Error: Subtitles directory not found: {self.subtitles_dir}")
            return
        
        # Get all transcript files
        transcript_files = list(self.subtitles_dir.glob("*.txt"))
        self.stats['total_files'] = len(transcript_files)
        
        print(f"Found {len(transcript_files)} transcript files")
        
        start_time = time.time()
        
        for i, filepath in enumerate(transcript_files):
            if i % 50 == 0:
                print(f"Processing file {i+1}/{len(transcript_files)}: {filepath.name}")
            
            self.process_transcript_file(filepath)
        
        self.stats['unique_words'] = len(self.word_index)
        processing_time = time.time() - start_time
        
        print(f"\nProcessing complete!")
        print(f"- Processed: {self.stats['processed_files']}/{self.stats['total_files']} files")
        print(f"- Total words: {self.stats['total_words']:,}")
        print(f"- Unique words: {self.stats['unique_words']:,}")
        print(f"- Total size: {self.stats['total_size']:,} bytes")
        print(f"- Processing time: {processing_time:.2f} seconds")
    
    def save_index(self, output_file="data/transcript_index.json"):
        """Save the transcript index to JSON file"""
        output_path = Path(output_file)
        
        # Create output directory if it doesn't exist
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Prepare final index structure
        final_index = {
            'metadata': {
                'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
                'total_videos': len(self.transcript_index),
                'total_words': self.stats['total_words'],
                'unique_words': self.stats['unique_words'],
                'total_size': self.stats['total_size']
            },
            'transcripts': self.transcript_index,
            'word_index': {word: list(videos) for word, videos in self.word_index.items()}
        }
        
        print(f"Saving transcript index to {output_path}...")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(final_index, f, separators=(',', ':'))
        
        # Get file size
        file_size = output_path.stat().st_size
        print(f"Transcript index saved: {file_size:,} bytes ({file_size/1024/1024:.1f} MB)")
        
        return output_path

def main():
    print("Medical Medium Archive - Transcript Indexer")
    print("=" * 50)
    
    indexer = TranscriptIndexer()
    
    # Process all transcripts
    indexer.process_all_transcripts()
    
    # Save the index
    index_file = indexer.save_index()
    
    print(f"\nTranscript indexing complete!")
    print(f"Index file: {index_file}")
    print(f"You can now use fast client-side transcript search!")

if __name__ == "__main__":
    main()