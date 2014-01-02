package nodejt400;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

public class JdbcJsonClient
{
	private final ConnectionProvider pool;

	public JdbcJsonClient(ConnectionProvider pool)
	{
		this.pool = pool;
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		Connection c = pool.getConnection();
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

	private String trim(String value)
	{
		return value == null ? null : value.trim();
	}

	public int update(String sql, String paramsJson)
			throws Exception
	{
		Connection c = pool.getConnection();
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
}
