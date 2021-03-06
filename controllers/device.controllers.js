const db = require('../db')
const emitter = require('../emitter.js')

class DeviceControllers{

    async getStatus(id_user) {
        const station = (await db.query("SELECT * FROM stations WHERE user_id = $1", [id_user])).rows[0]
        if (station){
            const {id} = station
            const modules = await this.getModules(id)
            const rings = await this.getVisibleRings(null, id)
            station.modules = modules
            station.rings = rings
            if (Date.now() - station.last_update < 300000) {
                station.active = true
            } else {
                station.active = false
            }
            station.type = "status"
        } else {
            return {error: 'Station not found'}
        }
        return station
    }

    async addStation(id_user, secret_key) {
        console.log(`New stations: ${id_user}`)
        try{
            const station = await db.query(`INSERT INTO stations (time, battery, lamp, user_id, guard, speaker, secret_key, last_update) VALUES (0, 0, 0, $1, false, 0, $2, NOW()) RETURNING *`,[id_user, secret_key])
            if (station) {
                for (let i = 0; i<5; i++){
                    await db.query(`INSERT INTO rings (name, time, active, visible, sunrise, music, user_id, station_id) VALUES ('ring', 0, false, false, true, 0, $1, $2)`,[id_user, station.id])
                }
                return {
                    error: null,
                    message: "SUCCESS"
                }
            } else {
                return {error: "Server Error"}
            }
        } catch(e) {
            console.log(e)
            return {error: "Server Error"}
        }
    }

    async getVisibleRings(id_user, id_station) {
        let rings
        if (id_station) {
            id_user = await this.getUserIdFromStationId(id_station)
        }
        rings = (await db.query("SELECT * FROM rings WHERE user_id = $1 and visible ORDER BY id", [id_user])).rows
        if (rings) {
            return rings
        }
        return {}
    }

    async setBrightness(id_user, brightness) {
        const station_id = await this.getStationIdFromUserId(id_user)
        emitter.eventBus.sendEvent('Updated data', station_id, 'remote', `BRT ${brightness}`);
        return {error: null}
    }

    async setSpeaker(id_user, volume){
        const station_id = await this.getStationIdFromUserId(id_user)
        emitter.eventBus.sendEvent('Updated data', station_id, 'remote', `SPQ ${volume}`);
        return {error: null}
    }

    async setVisibleRing(id_user, visible) {
        const station_id = await this.getStationIdFromUserId(id_user)
        const rings = (await db.query("SELECT id, visible FROM rings WHERE station_id = $1 ORDER BY id", [station_id])).rows
        console.log(rings)
        const updated_ring = await db.query("UPDATE rings SET visible = $1 WHERE id = $2 RETURNING *;", [visible, rings[count]])
    }

    async editRing(id_user, id_ring, time, active, sunrise, music){
        try {
            console.log(active, time, sunrise, music, id_ring, id_user)
            const updated_ring = await db.query("UPDATE rings SET active = $1, time=$2, sunrise = $3, music = $4, visible = true WHERE id = $5 and user_id = $6 RETURNING *;", [active, time, sunrise, music, id_ring, id_user])
                return {
                    type: "SAVE RING",
                    message: "Success",
                    state: updated_ring.rows[0].active,
                    error: null
                }
        } catch(e) {
            console.log(e)
            return {error: 'Server Error'}
        }
    }

    async setActiveRing(ring_id, user_id, state){
        try {
            const updated_ring = await db.query("UPDATE rings SET active = $1 WHERE id = $2 and user_id = $3 RETURNING *;",
            [state, ring_id, user_id])
            const active_rings = await db.query("SELECT active, id, time, sunrise, music FROM rings WHERE user_id = $1 ORDER BY id",[user_id])
            let req = ''
            let count = 0
            for (const i in active_rings.rows) {
                const ring = active_rings.rows[i]
                if (ring.active) {
                    count++
                    req += i
                    req += ("0000" + ring.time).slice(-4)
                    req += ring.music
                    req += ring.sunrise ? "1" : "0"
                }
            }
            req = "rng" + count + req
            const station_id = await this.getStationIdFromUserId(user_id)
            emitter.eventBus.sendEvent('Updated data', station_id, 'req', req)
            return {
                type: "SAVE RING",
                message: "Success",
                state: updated_ring.rows[0].active,
                error: null
            }
        } catch(e) {
            console.log(e)
            return {error: 'Server Error'}
        }
    }

    async setVisibleRing(ring_id, user_id, state){
        try {
            const updated_ring = await db.query("UPDATE rings SET visible = $1 WHERE id = $2 and user_id = $3 RETURNING *;",
            [state, ring_id, user_id]
            )
                return {
                    error: null,
                    message: "Success",
                }
        } catch(e) {
            console.log(e)
            return {error: 'Server Error'}
        }
    }

    async setModule(id_user, id_module, state){
        const station_id = await this.getStationIdFromUserId(id_user)
        emitter.eventBus.sendEvent('Updated data', station_id, 'remote', `MDL ${id_module} ${state}`);
        return {error: null}
    }

    async setStatus(status) {
        try{
            const user_id = (await db.query(
            `UPDATE stations
            SET time = $1,
                battery = $2,
                lamp = $3,
                last_update = NOW(),
                guard = $4,
                speaker = $5
            WHERE id = $6
            RETURNING user_id;`,
            [status.time,
            status.voltage,
            status.brightness,
            status.guard,
            status.speaker.volume,
            status.id]
            )).rows[0].user_id
            const rings_id = (await db.query(`
                with updated as (
                    UPDATE rings
                    SET active = false
                    WHERE user_id = $1
                    RETURNING id
                )
                SELECT *
                FROM updated
                ORDER BY id ASC;`,
                [user_id]
                )).rows

            for (let i in status.rings) {
                await db.query(`
                UPDATE rings 
                SET active = true,
                    time = $1,
                    sunrise = $2,
                    music = $3,
                    visible = true
                WHERE id = $4
                `,
                [status.rings[i].time,
                status.rings[i].sunrise,
                status.rings[i].music,
                rings_id[status.rings[i].id].id - 1]
                )
            }
            // ????????????
            emitter.eventBus.sendEvent('Updated status', user_id);
        } catch(e) {
            console.log(e)
        }
    }

    async changeGuard(id_user, state){
        const station_id = await this.getStationIdFromUserId(id_user)
        emitter.eventBus.sendEvent('Updated data', station_id, 'remote', `GRD ${state}`);
        
        return {
            error: null
        }
    }

    async getModules(id_station) {
        const modules = (await db.query(`SELECT * FROM modules WHERE station_id = $1`, [id_station])).rows
        if (modules) {
            modules.forEach((mod) => {
                if (mod.type<10) {
                    mod.active = true
                } else if (mod.type<20){
                        if (mod.last_value == '0') {
                            mod.active = true
                        } else {
                            mod.active = false
                        }
                } else {
                    if (mod.last_value == '0') {
                        mod.active = false
                    } else {
                        mod.active = true
                    }
                }

                if (Date.now()-mod.time > 60000) {
                    mod.active = false
                }
            
                
            })
            return modules
        }
        return {}
    }

    async addModule(user_id, station_id, id_module, type, time, value, location, name_module) {
        try{
            module = await db.query(
                'INSERT INTO modules (location, last_value, time, station_id, user_id, type, id_module, name) VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7) RETURNING *',
                [location, value, station_id, user_id, type, id_module, name_module]
                )
            console.log(module)
            return module
        } catch(e) {
            console.log(e)
            return {error: 'Server Error'}
        }
    }

    async deleteModule(id_module) {
        try{
            await db.query("DELETE FROM modules WHERE id_module = $1", [id_module])
            return {error: null, message: 'Success'}
        } catch(e){
            console.log(e)
            return {error: 'Server Error'}
        }
    }

    async updateModuleName(id_module, name_module, location){
        try{
            console.log(await db.query(`
                UPDATE modules SET
                    name = $2,
                    location = $3
                WHERE id_module = $1`,
                [id_module, name_module, location]))
            return {error: null, message: 'Success'}
        } catch(e) {
            console.log(e)
            return {error: 'Server Error'}
        }
    }

    async updateModule(id_module, type, value, time_update, station_id, name = "", location = ""){
        try{
                const id = await db.query(`
                        INSERT INTO modules (
                            id_module,
                            type,
                            last_value,
                            time,
                            location,
                            name,
                            station_id)
                        VALUES 
                            ($1,
                            $2,
                            $3,
                            NOW(),
                            'room',
                            'modules',
                            $4)
                        ON CONFLICT (id_module) DO UPDATE
                        SET id_module = $1,
                            type = $2,
                            last_value = $3,
                            time = NOW()
                    `, [
                        id_module,
                        type,
                        value,
                        station_id
                    ]
                )
        } catch(e) {
            console.log(e)
        }

    }

    async updateModules(station_id, status_message){
        console.log(status_message, station_id)
        for (let i in status_message) {
            const {id, type, value, time_update} = status_message[i]
            await this.updateModule(id, type, value, time_update, station_id)
        }
        try{
            const user_id = await this.getUserIdFromStationId(station_id)
            emitter.eventBus.sendEvent('Updated status',user_id);
        } catch(e){
            console.log(e)
        }
    }

    async getUserIdFromStationId(id){
        return (await db.query(`SELECT user_id FROM stations WHERE id = $1`,[id])).rows[0].user_id
    }

    async getStationIdFromUserId(id){
        return (await db.query(`SELECT id FROM stations WHERE user_id = $1`,[id])).rows[0].id
    }
}
const deviceControllers = new DeviceControllers()
module.exports = {deviceControllers, emitter}