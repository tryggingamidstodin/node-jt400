package nodejt400;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import com.ibm.as400.access.AS400JDBCConnectionPool;
import com.ibm.as400.access.AS400JDBCConnectionPoolDataSource;

public class DB2
{
	private final AS400JDBCConnectionPool sqlPool;

	public DB2(JSONObject jsonConf)
	{
		Props conf = new Props(jsonConf);
		AS400JDBCConnectionPoolDataSource ds = new AS400JDBCConnectionPoolDataSource();
		ds.setServerName(conf.get("host"));
		ds.setUser(conf.get("user"));
		ds.setPassword(conf.get("password"));
		String naming = conf.get("naming", "system");
		ds.setNaming(naming);
		ds.setDateFormat(conf.get("dateFormat", "iso"));
		ds.setMetaDataSource(0);
		String value = conf.get("sort");
		if (value != null)
		{
			ds.setSort(value);
		}
		value = conf.get("sortTable");
		if (value != null)
		{
			ds.setSortTable(value);
		}
		value = conf.get("sortLanguage");
		if (value != null)
		{
			ds.setSortLanguage(value);
		}
		value = conf.get("libraries");
		if (value != null)
		{
			ds.setLibraries(value);
		}
		this.sqlPool = new AS400JDBCConnectionPool(ds);
	}

	public static final DB2 getInstance(String jsonConf)
	{
		JSONObject conf = (JSONObject) JSONValue.parse(jsonConf);
		return new DB2(conf);
	}

	public String executeQuery(String sql, String paramsJson)
			throws Exception
	{
		Connection c = sqlPool.getConnection();
		PreparedStatement st = null;
		JSONArray array = new JSONArray();
		try
		{
			st = c.prepareStatement(sql);
			setParams(paramsJson, st);
			ResultSet rs = st.executeQuery();
			ResultSetMetaData metaData = rs.getMetaData();
			while (rs.next())
			{
				JSONObject json = new JSONObject();
				int columnCount = metaData.getColumnCount();
				for (int i = 1; i <= columnCount; i++)
				{
					json.put(metaData.getColumnName(i), trim(rs.getString(i)));
				}
				array.add(json);
			}

		}
		catch (Exception e)
		{
			throw e;
		}
		finally
		{
			if (st != null)
				st.close();
			c.close();
		}
		return array.toJSONString();
	}

	public int executeUpdate(String sql, String paramsJson)
			throws Exception
	{
		Connection c = sqlPool.getConnection();
		PreparedStatement st = null;
		int result = 0;
		try
		{
			st = c.prepareStatement(sql);
			setParams(paramsJson, st);
			result = st.executeUpdate();
		}
		catch (Exception e)
		{
			throw e;
		}
		finally
		{
			if (st != null)
				st.close();
			c.close();
		}
		return result;
	}

	private void setParams(String paramsJson, PreparedStatement st) throws SQLException
	{
		Object[] params = parseParams(paramsJson);
		for (int i = 0; i < params.length; i++)
		{
			Object value = params[i];
			if (value instanceof Long)
			{
				st.setLong(i + 1, (Long) value);
			}
			else if (value instanceof Double)
			{
				st.setDouble(i + 1, (Double) value);
			}
			else
			{
				st.setString(i + 1, value.toString());
			}
		}
	}

	private Object[] parseParams(String paramsJson)
	{
		JSONArray jsonArray = (JSONArray) JSONValue.parse(paramsJson);
		int n = jsonArray.size();
		Object[] params = new Object[n];
		for (int i = 0; i < n; i++)
		{
			params[i] = jsonArray.get(i);
		}
		return params;
	}

	private String trim(String value)
	{
		return value == null ? null : value.trim();
	}
}

class Props
{
	private final JSONObject w;

	public Props(JSONObject w)
	{
		this.w = w;
	}

	public String get(String key)
	{
		return (String) w.get(key);
	}

	public String get(String key, String defaultValue)
	{
		String value = (String) w.get(key);
		return value == null ? defaultValue : value;
	}
}