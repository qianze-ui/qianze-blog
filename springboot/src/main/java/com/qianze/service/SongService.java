package com.qianze.service;

import com.qianze.entity.Song;
import com.qianze.mapper.SongMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SongService {
    private final SongMapper mapper;
    public SongService(SongMapper mapper) { this.mapper = mapper; }

    public List<Song> findAll() { return mapper.findAll(); }
    public Song findById(Long id) { return mapper.findById(id); }

    public Song create(Song song) {
        // Dedup by songId (163 music songid)
        if (song.getSongId() != null) {
            Song existing = mapper.findBySongId(song.getSongId());
            if (existing != null) return existing;
        }
        if (song.getSortOrder() == null) song.setSortOrder(0);
        if (song.getSourceType() == null) song.setSourceType("external");
        if (song.getPlayCount() == null) song.setPlayCount(0);
        if (song.getPlayUrl() != null && (song.getUrl() == null || song.getUrl().isBlank())) {
            song.setUrl(song.getPlayUrl());
        }
        mapper.insert(song);
        return song;
    }

    public Song update(Long id, Song song) {
        song.setId(id);
        mapper.update(song);
        return song;
    }

    public void incrementPlayCount(Long id) { mapper.incrementPlayCount(id); }
    public void deleteById(Long id) { mapper.deleteById(id); }
}
