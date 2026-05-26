package com.qianze.mapper;

import com.qianze.entity.GuestMusicLog;
import org.apache.ibatis.annotations.*;

import java.util.List;
import java.util.Map;

@Mapper
public interface GuestMusicLogMapper {
    @Insert("INSERT INTO guest_music_logs (ip, country, province, city, browser, os, device, model, song_title, song_artist, song_url, source, created_at) " +
            "VALUES (#{ip}, #{country}, #{province}, #{city}, #{browser}, #{os}, #{device}, #{model}, #{songTitle}, #{songArtist}, #{songUrl}, #{source}, NOW())")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(GuestMusicLog log);

    @Select("SELECT * FROM guest_music_logs ORDER BY created_at DESC LIMIT 100")
    @Results({
        @Result(property = "songTitle", column = "song_title"),
        @Result(property = "songArtist", column = "song_artist"),
        @Result(property = "songUrl", column = "song_url"),
        @Result(property = "createdAt", column = "created_at")
    })
    List<GuestMusicLog> findRecent();

    @Select("SELECT song_title, song_artist, COUNT(*) as cnt FROM guest_music_logs GROUP BY song_title, song_artist ORDER BY cnt DESC LIMIT 10")
    List<Map<String, Object>> topSongs();
}
